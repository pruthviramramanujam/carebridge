# TraceMed — Medical Record Reconciliation

TraceMed is a demonstration application for reviewing fragmented medical records and identifying missing information, conflicting values, duplicate documents, and source gaps for human review.

## Problem

Medical records are often fragmented across providers. Inconsistencies and missing context can be difficult to spot during a handoff.

## Solution

TraceMed provides an evidence-linked review workflow. Its reconciliation engine flags:

- Missing dates on prescription and lab documents.
- Conflicting recorded values for the same patient and field.
- Duplicate documents with the same reliable file hash for a patient.
- Medication dose history without an explicit current-status fact.
- Facts with missing, unknown, or mismatched source-document references.

These are review flags, not diagnoses, treatment recommendations, or clinical conclusions.

## Features

- Rule-based reconciliation findings with rule identifiers, severity, messages, and supporting source references.
- A handoff report using fictional demo records and findings.
- Document intake for PDF, PNG, JPG, JPEG, and plain-text files up to 5 MB.
- Browser-local OCR for PNG and JPEG images; recognized text is passed through the same explicitly labeled fact extractor used for TXT files.
- Browser-side preview of uploaded or OCR-recognized text, with extracted facts retained for human review.
- Profile-scoped intake reconciliation that preserves document and fact provenance.
- Browser `localStorage` persistence for demo intake data.

## Architecture

- **Next.js App Router** provides the application pages and API routes.
- **TypeScript** defines the shared medical document, fact, and reconciliation finding types.
- **Browser-local Tesseract.js OCR** recognizes PNG and JPEG text without sending image content to an external OCR service.
- **Labeled fact extraction** in `src/lib/extract-medical-facts.ts` only extracts explicitly supported fields; it does not interpret free-form medical narrative.
- **Reconciliation rules** in `src/lib/medical-reconciliation.ts` compare supported documents and facts and return deterministic findings.
- **Synthetic demo data** in `src/lib/demo-data.ts` powers the handoff report and reconciliation examples.
- **Browser `localStorage`** retains demo intake records for the current browser. It is not secure authentication or tamper-proof storage.

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

- PDF parsing is not implemented; PDF uploads remain pending and are excluded from extraction.
- OCR uses aggregate page-level confidence, not per-word confidence. Confidence below 35 fails extraction; scores from 35 through 64 add a warning; scores of 65 or above proceed without that confidence warning. All extracted facts still require human review.
- Only explicitly labeled supported fields are extracted. Unsupported or ambiguous information is not guessed.
- Intake persistence uses browser `localStorage`. It is demo storage, not secure medical-record storage or permanent cloud storage.
- Reconciliation findings require human review. The application does not diagnose conditions, prescribe treatment, or automatically resolve medical conflicts.
- The application has no database or authentication system.

## Privacy and Demo Data

This project is intended for fictional data only. Do not upload real patient records, personal health information, or identifying details. Included records and findings are synthetic examples for demonstration.

## Deployment

Public Vercel URL:[ **\[tracemed-five-bay]**](https://tracemed-five-bay.vercel.app/)

## Team and Contributors

## 👥 Team Members & Contributions

| Member | Name | Contribution |
|---|---|---|
| Member 1 | Vinay | Frontend Development — UI design, navigation, responsive layouts, and medical document upload interface. |
| Member 2 | Qamar | OCR & Data Extraction — Browser-local image OCR, medical fact extraction, and OCR confidence validation. |
| Member 3 | Pruthvi | Medical Record Reconciliation — Conflict detection, duplicate document detection, missing information checks, and source traceability. |
| Member 4 | Stalin | Testing & Integration — Application testing, component integration, validation of patient-profile isolation, and deployment verification. |

*All extracted medical information is intended for human review. TraceMed is a record-reconciliation support tool, not a diagnostic system.*
