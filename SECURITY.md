# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.3.x (current) | ✅ |
| 1.2.x | ✅ security fixes only |
| < 1.2.0 | ❌ |

## Scope

AlkiSurf is a public read-only conditions dashboard. It has no user accounts, no authentication, no payment processing, and does not collect personally identifiable information. The primary external data sources are NDBC buoys, NWS forecast grids, NOAA tides, and Open-Meteo — all public APIs.

**In scope:**
- Server-side request forgery (SSRF) via user-controlled parameters
- Remote code execution
- Data injection into the conditions log or community reports
- Exposure of server environment variables or API keys
- Third-party dependency vulnerabilities with a realistic exploit path

**Out of scope:**
- Denial of service / resource exhaustion
- Rate limiting
- Missing security headers on a public informational site
- Theoretical vulnerabilities with no realistic exploit path

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report security issues by email to **kmkramer@gmail.com** with the subject line `[alkisurf] Security Report`.

Include:
- Description of the vulnerability
- Steps to reproduce or proof-of-concept
- Potential impact
- Suggested fix if you have one

**Response time:** I aim to acknowledge within 48 hours and provide an assessment within 7 days.

**Disclosure:** Please allow reasonable time to investigate and patch before public disclosure. I will credit reporters in the changelog unless you prefer anonymity.

## Dependency Vulnerabilities

Dependencies are managed with npm. If you discover a vulnerability in a dependency, please check [npm advisories](https://github.com/advisories) first. If the advisory is not yet public or the fix requires a non-trivial code change on our end, report it via the email above.
