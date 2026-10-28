# Server-side administrator Pro activation

Acceptance: administrator Pro unlock always calls `/api/verify-license`; credentials exist only in server Secrets; exact configured HTTPS origins are enforced; the retired public preview exception and local-flag fallback are removed; customer signed keys still work. Rotation applies on the next verification. Verify malformed input, origin spoofing, missing configuration, frontend denial and production build.

Implementation: regression tests first; secret-based backend authorization; client format/status validation; remove local fallback; run security/payment tests and build; document deployment configuration. Production deployment is outside this change.
