import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, requireBodyObject, requireString, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookUserPk, deviceTokenSk } from "@/app/app/api/book/_lib/keys";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const body = requireBodyObject(await req.json());
    const endpoint = requireString(body.endpoint, "endpoint", { maxLength: 2000 });

    const tableName = await getBookTableName();

    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(user.sub),
          SK: deviceTokenSk(endpoint),
        },
      })
    );

    return bookOk({ unregistered: true });
  });
}
