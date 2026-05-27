export class WebhookPayloadDto {
  providerEventId: string; // The clinic's internal tracking ID
  patientId: string;       // The Solace Patient ID
  documentType: string;    // e.g., "LabResult", "ProgressNote"
  filePayload: string;     // Simulated Base64 string of the actual medical record
}