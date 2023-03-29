import {
  GatewayIntentBits,
  Client,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Events,
  Collection,
} from "discord.js";
import { commandClass } from "./@types/index";
import fs from "fs";
import path from "path";
require("dotenv").config();

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const clientCommands: Collection<string, commandClass> = new Collection();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// and deploy your commands!
client.once("ready", async () => {
  // Grab all the command files from the commands directory you created earlier
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file: string) => file.endsWith(".ts") || file.endsWith(".js"));

  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const command: commandClass = require(`./commands/${file}`);
    clientCommands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  await client.application?.commands.set(commands, process.env.GUILD_ID!);
  console.log("Ready!");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = clientCommands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
