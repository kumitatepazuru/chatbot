import { CommandInteraction, SlashCommandBuilder } from "discord.js"

export type commandClass = {
    data: SlashCommandBuilder,
    execute: (interaction: CommandInteraction) => Promise<void>
}