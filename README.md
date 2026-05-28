# Solace: Event-Driven Medical Ingestion Pipeline

An asynchronous, high-concurrency pipeline designed to ingest, validate, and securely process Protected Health Information (PHI) payloads at scale. 

Built with an event-driven architecture, this system decouples traffic reception from heavy cryptographic processing, ensuring the API remains highly available even during massive traffic spikes.

<img width="1672" height="941" alt="image" src="https://github.com/user-attachments/assets/8a87f2f5-2808-4eaa-bb4a-c0eedcc36887" />

## 🌐 Live Deployments

This monorepo is fully deployed and operational in the cloud using a highly decoupled infrastructure stack.

* **Interactive Audit Dashboard:** (https://sol-event-ingestion-ui.netlify.app/)
* **API Gatekeeper & Worker:** Render Web Service
* **Database (PostgreSQL):** Hosted on **Supabase** (via IPv4 Session Pooler)
* **Message Broker (Redis):** Hosted on **Upstash**

## 🏗️ System Architecture

The pipeline is broken down into four distinct operational phases:

### 1. Traffic Control & Validation (Gatekeeper)
A NestJS API acts as the primary ingress point. It immediately validates incoming webhooks, logs the initial `IngestionEvent` to PostgreSQL with a `PENDING` status, and offloads the heavy payload to a Redis queue. This allows the API to return a `202 Accepted` response in milliseconds, preventing connection timeouts during high-volume surges.

### 2. The Message Broker (BullMQ / Redis)
**Upstash Redis** acts as the shock absorber for the system. Webhooks are buffered in a BullMQ queue, allowing the system to absorb traffic spikes (e.g., 500 concurrent requests) without overwhelming the database or compute resources. 

### 3. Headless Background Processing
A background worker process continuously polls the Redis queue, pulling jobs at a controlled concurrency limit (5 simultaneous connections). 
* **Processing:** Simulates AES-256 cryptographic encryption of the PHI payload.
* **Fault Tolerance:** Transient failures trigger an **Exponential Backoff** retry strategy.
* **Dead Letter Queue (DLQ):** Fatal errors (e.g., corrupted file signatures) bypass the retry loop and are isolated into a DLQ to prevent queue blocking.

### 4. Database Persistence & Lifecycle Management
Metadata and event statuses are persisted in a **Supabase PostgreSQL** database. 
* **Memory Optimization:** To operate strictly within a 256MB memory ceiling, the worker implements aggressive Day 2 operations. A cron job fires every 10 minutes to explicitly `DELETE` processed records and run a `VACUUM` command, instantly reclaiming dead tuple space and preventing index bloat.

## 🚀 Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS
* **Backend:** Node.js, NestJS, TypeORM
* **Queueing:** BullMQ, Redis
* **Infrastructure:** Render (Compute), Netlify (Static UI
