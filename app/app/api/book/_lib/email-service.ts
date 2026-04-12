import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

let sesClient: SESv2Client | null = null;

function getSES(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({});
  }
  return sesClient;
}

type SendEmailParams = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  senderEmail: string;
};

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; error?: string }> {
  try {
    await getSES().send(
      new SendEmailCommand({
        FromEmailAddress: params.senderEmail,
        Destination: { ToAddresses: [params.to] },
        Content: {
          Simple: {
            Subject: { Data: params.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: params.textBody, Charset: "UTF-8" },
              Html: { Data: params.htmlBody, Charset: "UTF-8" },
            },
          },
        },
      })
    );
    return { sent: true };
  } catch (error: unknown) {
    console.error("[email-service] send failed:", String(error));
    return { sent: false, error: String(error) };
  }
}
