import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { logger } from "@/lib/logging/logger";
import { awsClientConfig } from "@/app/app/api/_lib/aws";

let sesClient: SESv2Client | null = null;

function getSES(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({ ...awsClientConfig });
  }
  return sesClient;
}

type SendEmailParams = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  /** May be a bare address or a friendly form like `ChapterFlow <info@chapterflow.ca>`. */
  senderEmail: string;
  replyTo?: string;
  /** Extra SMTP headers (e.g. List-Unsubscribe). Required on commercial email. */
  headers?: Array<{ Name: string; Value: string }>;
  /** SES configuration set for bounce/complaint event tracking. */
  configurationSet?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; error?: string }> {
  try {
    await getSES().send(
      new SendEmailCommand({
        FromEmailAddress: params.senderEmail,
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
        ConfigurationSetName: params.configurationSet || undefined,
        Destination: { ToAddresses: [params.to] },
        Content: {
          Simple: {
            Subject: { Data: params.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: params.textBody, Charset: "UTF-8" },
              Html: { Data: params.htmlBody, Charset: "UTF-8" },
            },
            Headers: params.headers,
          },
        },
      })
    );
    return { sent: true };
  } catch (error: unknown) {
    logger.error("email_service_send_failed", { err: error });
    return { sent: false, error: String(error) };
  }
}
