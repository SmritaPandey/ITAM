async function main() {
  const url = "https://api-production-fe27.up.railway.app/api/v1/auth/forgot-password";
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "smrita@neurqai.com" }),
    });
    
    const data = await res.json();
    console.log('Response status:', res.status);
    console.log('Response data:', data);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

main();
