import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

/**
 * Slack connector is intentionally not provisioned by this change. Configure
 * SLACK_CONNECTOR through Vercel Connect before enabling a deployed channel.
 */
export default slackChannel({
  credentials: connectSlackCredentials(
    process.env.SLACK_CONNECTOR ?? "slack/corleon-engine",
  ),
});
