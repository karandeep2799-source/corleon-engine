import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

/**
 * Slack is not provisioned by this integration. Configure the Vercel Connect
 * connector and its event trigger only after the agent passes local validation.
 */
export default slackChannel({
  credentials: connectSlackCredentials(
    process.env.SLACK_CONNECTOR ?? "slack/corleon-engine",
  ),
});
