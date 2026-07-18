# Vulnerability Disclosure Policy

QS Assets welcomes good-faith security research that helps protect our customers and platform.

## Contact

Report suspected vulnerabilities to [security@qsasset.com](mailto:security@qsasset.com). Include the affected URL or component, impact, reproduction steps, and any supporting evidence. Please encrypt sensitive reports when practical and do not send secrets or personal data that are not required to demonstrate the issue.

The canonical machine-readable policy is available at [/.well-known/security.txt](https://www.qsasset.com/.well-known/security.txt), and the public Trust Center is available at [/security](https://www.qsasset.com/security).

## Scope

In scope:

- QS Assets production web and API services under `*.qsasset.com`
- QS Discovery Agent and official QS Assets release artifacts
- Authentication, authorization, tenant isolation, data exposure, and update integrity issues

Out of scope:

- Third-party services not operated by QS Assets
- Social engineering, phishing, physical attacks, spam, or denial-of-service testing
- Automated scanning that creates excessive traffic or degrades service
- Reports that only identify missing best-practice headers, version banners, or theoretical issues without a demonstrated security impact

## Safe harbor

If you act in good faith, stay within this policy, avoid privacy violations and service disruption, and give us reasonable time to remediate before public disclosure, QS Assets will not initiate legal action against you for your research. If a third party initiates action related to compliant research, we will make our authorization of that research known.

Stop testing and notify us immediately if you encounter customer data. Do not access, modify, retain, or disclose data beyond the minimum needed to establish the vulnerability.

## Response targets

These are response targets, not a guarantee:

- Initial acknowledgement: within 2 business days
- Triage and severity assessment: within 5 business days
- Critical issue remediation target: 7 calendar days
- High issue remediation target: 30 calendar days
- Medium or low issue remediation target: 90 calendar days

We will provide status updates at least every 10 business days while a validated report remains open. Coordinated disclosure timing will be agreed with the reporter based on risk and remediation progress.

## Research guidelines

- Use accounts and tenants you own or have explicit permission to test.
- Prefer non-destructive proofs of concept.
- Do not exfiltrate data, establish persistence, or pivot to other systems.
- Do not publicly disclose an unresolved issue without coordinating with us.
- Submit one vulnerability per report unless multiple findings are required to demonstrate a single impact.

We may acknowledge reporters who request credit after remediation, subject to customer privacy and legal constraints.
