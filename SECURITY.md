# Security policy

## Supported version

Security fixes target the current `main` branch. No released version has a
long-term support commitment yet.

## Report a vulnerability

Please use the repository host's private security-advisory feature after this
project is published. Do not open a public issue for an unpatched vulnerability.
Include reproduction steps, affected browser/OS, impact, and any suggested fix.

If private reporting is not configured yet, contact the repository owner through
the hosting platform and ask for a private channel without including exploit
details in the first public message.

## Artifact threat model

Benchmark artifacts contain executable JavaScript and GLSL. The site therefore:

- loads artifacts only from the reviewed, same-origin manifest;
- rejects network, storage, worker, timer, dynamic-code, and DOM access in static
  repository validation;
- applies a strict Content Security Policy;
- does not execute pasted code, remote URLs, or unreviewed uploads;
- limits source size and preserves failures as data.

Static checks are not a sandbox. Reviewers should inspect new artifact code, test
it in a disposable browser profile, and watch for excessive compile/render times
or GPU context loss. A future public submission service must use process/browser
isolation, watchdogs, resource limits, and a separate origin; client-side regexes
are not a security boundary.
