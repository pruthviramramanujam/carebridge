# CareBridge — Medical History Gap Detector

CareBridge is a hackathon demo exploring how clinicians and care teams can review fragmented medical history and identify information that needs follow-up.

## Problem

Medical records are often fragmented across providers. This can lead to repeated information gathering and make inconsistencies or missing context difficult to spot during a handoff.

## Solution

CareBridge demonstrates an evidence-linked review workflow. Its reconciliation engine flags:

- Missing dates on prescription and lab documents.
- Conflicting recorded values for the same patient and field.
- Duplicate documents with the same file hash for a patient.
- Medication dose history without an explicit current-status fact.
- Facts with missing, unknown, or mismatched source-document references.

These are review flags, not clinical conclusions.

## Features

- Rule-based reconciliation findings with rule identifiers, severity, messages, and supporting source references.
- A handoff report that displays the synthetic demo findings and resolves source document IDs to titles where possible.
- Document intake for PDF, PNG, JPEG, and plain-text files up to 5 MB.
- Browser-side plain-text preview; captured text is not automatically converted into medical facts.
- PDF and image metadata intake with a pending status; file contents are not parsed or OCR-processed.
- Browser-local persistence of uploaded document metadata and plain-text content, displayed separately from reconciled demo records.

## Architecture

- **Next.js App Router** provides the application pages and API routes.
- **TypeScript** defines the shared medical document, fact, and reconciliation finding types.
- **Reconciliation rules** in `src/lib/medical-reconciliation.ts` compare the supplied documents and facts and return deterministic findings.
- **Synthetic demo data** in `src/lib/demo-data.ts` powers the handoff report and reconciliation examples.
- **Browser `localStorage`** retains demo intake metadata and plain-text content for the current browser. Uploaded intake is not sent to the reconciliation engine.

## Setup

Prerequisites: Node.js 20.9 or later and npm.

From the repository root, install the locked dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To verify a production build:

```bash
npm run build
```

## Limitations

- PDF parsing and image OCR are not implemented. PDF and image uploads store metadata only and remain pending.
- Plain-text files can be previewed, but uploaded entries are not automatically reconciled or converted into medical facts.
- Intake persistence uses browser `localStorage`. It is browser-local demo storage, not secure medical-record storage or permanent cloud storage.
- Reconciliation findings require human review. They are not diagnoses, treatment recommendations, or clinically validated outputs.
- The application has no database or authentication system.

## Privacy and Demo Data

This project is intended for fictional data only. Do not upload real patient records, personal health information, or identifying details. The included records and findings are synthetic examples for demonstration.

## Deployment

Public Vercel URL: **[Add deployed Vercel URL]**

## Team and Contributors

- [Team member name] — [role or contribution]
- [Team member name] — [role or contribution]
