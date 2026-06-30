# Fine-Tuning Gemma 4 for ITAM

This directory contains everything needed to fine-tune Google Gemma 4 on your specific ITAM data, creating a model that deeply understands your organization's asset management domain.

## Overview

We use **QLoRA** (Quantized Low-Rank Adaptation) to efficiently fine-tune the model:
- Base model is loaded in 4-bit quantization (saves ~75% VRAM)
- Only small adapter layers are trained (saves ~99% of parameters)
- Result: Fine-tune a 12B model on a single 24GB GPU

## Prerequisites

- **Hardware**: NVIDIA GPU with 24GB+ VRAM (A100, RTX 4090, A6000) or cloud GPU
- **Software**: Python 3.10+, CUDA 12.1+, Docker (optional)
- **Data**: At least 50-200 examples per task (more is better)

## Quick Start

### 1. Prepare Training Data

Export your app's data into training format:

```bash
# From the project root
cd apps/api
npx ts-node ../../ai/training/prepare-data.ts
```

This generates `training-data.jsonl` with examples from your:
- Asset records → classification and risk analysis examples
- Resolved tickets → ticket classification and resolution examples
- Compliance data → compliance analysis examples
- Patch records → prioritization examples
- KB articles → Q&A examples

### 2. Fine-Tune with Docker (Recommended)

```bash
cd ai/training
docker build -f Dockerfile.finetune -t itam-finetune .
docker run --gpus all -v $(pwd)/data:/data -v ~/.cache/huggingface:/root/.cache/huggingface \
  -e HF_TOKEN=your_token_here \
  itam-finetune
```

### 3. Fine-Tune Locally

```bash
pip install unsloth transformers trl peft datasets
python fine-tune.py \
  --data data/training-data.jsonl \
  --model google/gemma-4-12b-it \
  --output ./itam-gemma4-12b \
  --epochs 3 \
  --lr 2e-4 \
  --lora-rank 16
```

### 4. Deploy Fine-Tuned Model

```bash
# Option A: vLLM (production)
docker run --gpus all -p 8000:8000 \
  -v $(pwd)/itam-gemma4-12b:/model \
  vllm/vllm-openai --model /model

# Option B: Ollama (development)
# Create Modelfile pointing to merged weights
ollama create itam-gemma4 -f Modelfile
ollama run itam-gemma4
```

## Training Data Format

Each line in the JSONL file should be a conversation:

```json
{
  "conversations": [
    {"role": "system", "content": "You are an expert IT asset management assistant..."},
    {"role": "user", "content": "What is the risk level of server SRV-PROD-01?"},
    {"role": "assistant", "content": "Based on the asset profile for SRV-PROD-01:\n\n**Risk Level: HIGH (78/100)**\n\nKey factors:\n- Running Windows Server 2019 with 3 unpatched critical CVEs\n- RDP (port 3389) exposed on public interface\n- No endpoint protection agent detected\n- Last compliance scan: 45 days ago (overdue)\n\n**Recommendations:**\n1. Immediately apply KB5034441 (critical RCE fix)\n2. Restrict RDP access via firewall rules\n3. Install endpoint protection agent\n4. Schedule compliance re-scan"}
  ]
}
```

## Tips for Better Results

1. **Quality over quantity**: 200 high-quality examples beat 2000 mediocre ones
2. **Cover edge cases**: Include examples with missing data, unusual assets, complex queries
3. **Domain terminology**: Use your org's actual terminology (asset tags, dept names, etc.)
4. **Multi-turn**: Include multi-turn conversations, not just single Q&A
5. **Tool use examples**: Include examples where the model should call tools
6. **Negative examples**: Include examples where the model should say "I don't know"
