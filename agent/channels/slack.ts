import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

const slackConnector = process.env.SLACK_CONNECTOR ?? "slack/corleon-copilot";

export default slackChannel({
  credentials: connectSlackCredentials(slackConnector),
});
