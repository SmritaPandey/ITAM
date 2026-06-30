#!/usr/bin/env python3
"""
Fine-tune Gemma 4 12B on ITAM-specific data using QLoRA.

Requirements:
  pip install unsloth transformers trl peft datasets bitsandbytes

Usage:
  python fine-tune.py --data data/training-data.jsonl --output ./itam-gemma4-12b
  python fine-tune.py --data data/training-data.jsonl --model google/gemma-4-12b-it --epochs 3 --lr 2e-4
"""

import argparse
import json
import os
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune Gemma 4 for ITAM")
    parser.add_argument("--data", type=str, required=True, help="Path to training data JSONL file")
    parser.add_argument("--model", type=str, default="google/gemma-4-12b-it", help="Base model ID")
    parser.add_argument("--output", type=str, default="./itam-gemma4-12b", help="Output directory for fine-tuned model")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--lora-rank", type=int, default=16, help="LoRA rank (higher = more capacity, more VRAM)")
    parser.add_argument("--lora-alpha", type=int, default=32, help="LoRA alpha scaling factor")
    parser.add_argument("--batch-size", type=int, default=2, help="Per-device train batch size")
    parser.add_argument("--grad-accum", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--max-seq-len", type=int, default=4096, help="Maximum sequence length")
    parser.add_argument("--warmup-ratio", type=float, default=0.03, help="Warmup ratio")
    parser.add_argument("--merge", action="store_true", help="Merge LoRA weights into base model after training")
    parser.add_argument("--push-to-hub", type=str, default=None, help="Push merged model to HuggingFace Hub repo")
    return parser.parse_args()


def load_training_data(data_path: str) -> list:
    """Load JSONL training data."""
    data = []
    with open(data_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                data.append(item)
            except json.JSONDecodeError as e:
                print(f"Warning: Skipping malformed line: {e}")
    print(f"Loaded {len(data)} training examples from {data_path}")
    return data


def format_conversations(examples: list) -> list[dict]:
    """Convert conversations to the format expected by SFTTrainer."""
    formatted = []
    for ex in examples:
        convs = ex.get("conversations", [])
        if not convs:
            continue
        # Build text in ChatML format
        text_parts = []
        for msg in convs:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                text_parts.append(f"<start_of_turn>system\n{content}<end_of_turn>")
            elif role == "user":
                text_parts.append(f"<start_of_turn>user\n{content}<end_of_turn>")
            elif role == "assistant":
                text_parts.append(f"<start_of_turn>model\n{content}<end_of_turn>")
        formatted.append({"text": "\n".join(text_parts)})
    return formatted


def main():
    args = parse_args()

    # Validate training data exists
    if not os.path.exists(args.data):
        print(f"Error: Training data file not found: {args.data}")
        print("\nGenerate training data first:")
        print("  cd apps/api && npx ts-node ../../ai/training/prepare-data.ts")
        sys.exit(1)

    print("=" * 60)
    print("ITAM Gemma 4 Fine-Tuning")
    print("=" * 60)
    print(f"  Base model:    {args.model}")
    print(f"  Training data: {args.data}")
    print(f"  Output:        {args.output}")
    print(f"  Epochs:        {args.epochs}")
    print(f"  LoRA rank:     {args.lora_rank}")
    print(f"  Learning rate: {args.lr}")
    print(f"  Max seq len:   {args.max_seq_len}")
    print("=" * 60)

    # Try to use Unsloth for 2x faster training
    try:
        from unsloth import FastLanguageModel
        USE_UNSLOTH = True
        print("\n✅ Using Unsloth for 2x faster training")
    except ImportError:
        USE_UNSLOTH = False
        print("\n⚠️  Unsloth not found, falling back to standard transformers")
        print("   Install with: pip install unsloth")

    # Load and format data
    raw_data = load_training_data(args.data)
    formatted_data = format_conversations(raw_data)
    print(f"Formatted {len(formatted_data)} training conversations")

    if len(formatted_data) < 10:
        print("\n⚠️  Warning: Very few training examples. Recommended minimum is 50-200.")
        print("   The model may overfit with too few examples.\n")

    # Load model
    print("\nLoading model (this may take a few minutes)...")

    if USE_UNSLOTH:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.model,
            max_seq_length=args.max_seq_len,
            load_in_4bit=True,  # QLoRA: 4-bit quantization
            dtype=None,  # Auto-detect
        )

        # Apply LoRA adapters
        model = FastLanguageModel.get_peft_model(
            model,
            r=args.lora_rank,
            lora_alpha=args.lora_alpha,
            lora_dropout=0.05,
            target_modules=[
                "q_proj", "k_proj", "v_proj", "o_proj",
                "gate_proj", "up_proj", "down_proj",
            ],
            bias="none",
            use_gradient_checkpointing="unsloth",  # 30% less VRAM
        )
    else:
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype="bfloat16",
            bnb_4bit_use_double_quant=True,
        )

        tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            args.model,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True,
        )

        model = prepare_model_for_kbit_training(model)

        lora_config = LoraConfig(
            r=args.lora_rank,
            lora_alpha=args.lora_alpha,
            lora_dropout=0.05,
            target_modules=[
                "q_proj", "k_proj", "v_proj", "o_proj",
                "gate_proj", "up_proj", "down_proj",
            ],
            bias="none",
            task_type="CAUSAL_LM",
        )
        model = get_peft_model(model, lora_config)

    # Print trainable parameters
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nTrainable parameters: {trainable_params:,} / {total_params:,} ({100 * trainable_params / total_params:.2f}%)")

    # Create dataset
    from datasets import Dataset
    dataset = Dataset.from_list(formatted_data)

    # Split into train/eval (90/10)
    if len(formatted_data) > 20:
        split = dataset.train_test_split(test_size=0.1, seed=42)
        train_dataset = split["train"]
        eval_dataset = split["test"]
    else:
        train_dataset = dataset
        eval_dataset = None

    # Configure trainer
    from trl import SFTTrainer, SFTConfig

    training_args = SFTConfig(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_ratio=args.warmup_ratio,
        lr_scheduler_type="cosine",
        weight_decay=0.01,
        fp16=False,
        bf16=True,
        logging_steps=1,
        save_strategy="epoch",
        eval_strategy="epoch" if eval_dataset else "no",
        max_seq_length=args.max_seq_len,
        dataset_text_field="text",
        seed=42,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        args=training_args,
    )

    # Train
    print("\n🚀 Starting training...")
    print(f"   Train examples: {len(train_dataset)}")
    if eval_dataset:
        print(f"   Eval examples:  {len(eval_dataset)}")
    print(f"   Effective batch: {args.batch_size * args.grad_accum}")
    print()

    trainer.train()

    # Save LoRA adapter
    print(f"\n💾 Saving LoRA adapter to {args.output}")
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)

    # Optionally merge weights
    if args.merge:
        print("\n🔀 Merging LoRA weights into base model...")
        merged_dir = f"{args.output}-merged"

        if USE_UNSLOTH:
            model.save_pretrained_merged(merged_dir, tokenizer)
        else:
            merged_model = model.merge_and_unload()
            merged_model.save_pretrained(merged_dir)
            tokenizer.save_pretrained(merged_dir)

        print(f"   Merged model saved to: {merged_dir}")

        # Push to hub if requested
        if args.push_to_hub:
            print(f"\n📤 Pushing to HuggingFace Hub: {args.push_to_hub}")
            if USE_UNSLOTH:
                model.push_to_hub_merged(args.push_to_hub, tokenizer)
            else:
                merged_model.push_to_hub(args.push_to_hub)
                tokenizer.push_to_hub(args.push_to_hub)

    print("\n" + "=" * 60)
    print("✅ Fine-tuning complete!")
    print("=" * 60)
    print(f"\nTo deploy the fine-tuned model:")
    if args.merge:
        print(f"  vLLM:   docker run --gpus all -p 8000:8000 -v {os.path.abspath(merged_dir)}:/model vllm/vllm-openai --model /model")
    else:
        print(f"  Adapter saved at: {os.path.abspath(args.output)}")
        print(f"  Merge with: python fine-tune.py --data {args.data} --merge")


if __name__ == "__main__":
    main()
