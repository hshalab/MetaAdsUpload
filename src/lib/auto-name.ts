import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Generates an auto-name for assignments.
 * Format: "SE Fervin Mar12 #1 STATIC LP Evergreen GutHealth PawLicking Hook>Problem>CTA 122 Oskar"
 */

interface AutoNameParts {
  countryCode: string | null;
  editorName: string;
  batchNumber: number;
  productCode: string | null;
  formatName: string | null;
  landingPage: string | null;
  offerTypeName: string | null;
  angleName: string | null;
  scriptStructureName: string | null;
  videoLengthSeconds: number | null;
  creativeStrategistName: string | null;
  createdAt: Date;
}

export function buildAutoName(data: AutoNameParts): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[data.createdAt.getMonth()];
  const day = data.createdAt.getDate();

  const parts: string[] = [];

  if (data.countryCode) parts.push(data.countryCode);

  const editorFirstName = data.editorName.split(" ")[0];
  parts.push(editorFirstName);

  parts.push(`${month}${day}`);
  parts.push(`#${data.batchNumber}`);

  if (data.formatName) parts.push(data.formatName);
  if (data.landingPage) parts.push(data.landingPage);
  if (data.offerTypeName) parts.push(data.offerTypeName);
  if (data.productCode) parts.push(data.productCode);
  if (data.angleName) parts.push(data.angleName);
  if (data.scriptStructureName) parts.push(data.scriptStructureName);

  if (data.videoLengthSeconds && data.videoLengthSeconds > 0) {
    parts.push(String(data.videoLengthSeconds));
  }

  if (data.creativeStrategistName) {
    const csFirstName = data.creativeStrategistName.split(" ")[0];
    parts.push(csFirstName);
  }

  return parts.join(" ");
}

/**
 * Generates auto-name by looking up all related option names from the DB.
 */
export async function generateAutoName(assignment: {
  batchNumber: number;
  formatId: string | null;
  angleId: string | null;
  productId: string | null;
  countryId: string | null;
  offerTypeId: string | null;
  scriptStructureId: string | null;
  landingPage: string | null;
  assignedToId: string;
  creativeStrategistId: string | null;
  videoLengthSeconds: number | null;
  createdAt: Date;
}): Promise<string> {
  const [editor, angle, format, product, country, offerType, scriptStructure, cs] = await Promise.all([
    db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, assignment.assignedToId)).then(r => r[0]),
    assignment.angleId
      ? db.select({ name: schema.angles.name }).from(schema.angles).where(eq(schema.angles.id, assignment.angleId)).then(r => r[0])
      : null,
    assignment.formatId
      ? db.select({ name: schema.formats.name }).from(schema.formats).where(eq(schema.formats.id, assignment.formatId)).then(r => r[0])
      : null,
    assignment.productId
      ? db.select({ code: schema.products.code }).from(schema.products).where(eq(schema.products.id, assignment.productId)).then(r => r[0])
      : null,
    assignment.countryId
      ? db.select({ code: schema.countries.code }).from(schema.countries).where(eq(schema.countries.id, assignment.countryId)).then(r => r[0])
      : null,
    assignment.offerTypeId
      ? db.select({ name: schema.offerTypes.name }).from(schema.offerTypes).where(eq(schema.offerTypes.id, assignment.offerTypeId)).then(r => r[0])
      : null,
    assignment.scriptStructureId
      ? db.select({ name: schema.scriptStructures.name }).from(schema.scriptStructures).where(eq(schema.scriptStructures.id, assignment.scriptStructureId)).then(r => r[0])
      : null,
    assignment.creativeStrategistId
      ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, assignment.creativeStrategistId)).then(r => r[0])
      : null,
  ]);

  return buildAutoName({
    countryCode: country?.code || null,
    editorName: editor?.name || "Unknown",
    batchNumber: assignment.batchNumber,
    productCode: product?.code || null,
    formatName: format?.name || null,
    landingPage: assignment.landingPage,
    offerTypeName: offerType?.name || null,
    angleName: angle?.name || null,
    scriptStructureName: scriptStructure?.name || null,
    videoLengthSeconds: assignment.videoLengthSeconds,
    creativeStrategistName: cs?.name || null,
    createdAt: assignment.createdAt,
  });
}
