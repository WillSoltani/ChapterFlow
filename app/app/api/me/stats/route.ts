import { NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, getTableName } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const tableName = await getTableName();
    const PK = `USER#${user.sub}`;

    // Projects count
    const projRes = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :pfx)",
        ExpressionAttributeValues: { ":pk": PK, ":pfx": "PROJECT#" },
        Select: "COUNT",
      })
    );

    // Files + total bytes (uploads so far)
    const fileRes = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :pfx)",
        ExpressionAttributeValues: { ":pk": PK, ":pfx": "FILE#" },
        Limit: 250, // fine for now; we can paginate later
      })
    );

    const totalProjects = Number(projRes.Count ?? 0);

    const files = fileRes.Items ?? [];

    // Build lookup: rawFileId → raw sizeBytes, and sum total uploaded bytes
    const rawSizeByFileId: Record<string, number> = {};
    let bytes = 0;
    for (const it of files) {
      const n = it?.sizeBytes == null ? 0 : Number(it.sizeBytes);
      const sz = Number.isFinite(n) ? n : 0;
      if (it?.kind === "raw") {
        bytes += sz;
        const fid = typeof it.fileId === "string" ? it.fileId : "";
        if (fid) rawSizeByFileId[fid] = sz;
      }
    }

    // filesConverted = number of output files with status "done"
    const filesConverted = files.filter(
      (it) =>
        it?.kind === "output" &&
        it?.status === "done" &&
        (it?.artifactType == null || it?.artifactType === "conversion")
    ).length;

    // spaceSavedBytes = sum of (rawSize - outputSize) for completed conversions
    // where the output is actually smaller than the raw input
    let spaceSavedBytes = 0;
    for (const it of files) {
      if (it?.kind !== "output" || it?.status !== "done") continue;
      if (it?.artifactType && it?.artifactType !== "conversion") continue;
      const srcId = typeof it.sourceFileId === "string" ? it.sourceFileId : "";
      if (!srcId) continue;
      const rawSz = rawSizeByFileId[srcId] ?? 0;
      const outN = it?.sizeBytes == null ? 0 : Number(it.sizeBytes);
      const outSz = Number.isFinite(outN) ? outN : 0;
      const saved = rawSz - outSz;
      if (saved > 0) spaceSavedBytes += saved;
    }

    return NextResponse.json({
      totalProjects,
      filesConverted,
      spaceSavedBytes,
      uploadedBytes: bytes,
    });
  } catch (e: unknown) {
    const msg = String((e as { message?: unknown })?.message ?? "");
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("GET /app/api/me/stats error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
