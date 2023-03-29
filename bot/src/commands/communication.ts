import { commandClass } from "../@types/index";
import { GuildMember, SlashCommandBuilder } from "discord.js";
import {
  EndBehaviorType,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { OpusEncoder } from "@discordjs/opus";
import { createFFmpeg } from "@ffmpeg/ffmpeg";
import FormData from "form-data";
import axios from "axios";
import fs from "fs";

const ffmpeg = createFFmpeg({ log: true });
(async () => {
  await ffmpeg.load();
})();

const convertQueue: (Uint8Array | number[] | null)[] = [];

const convertWav = async (tempBuffer: number[]) => {
  ffmpeg.FS("writeFile", "input.pcm", new Uint8Array(tempBuffer));
  await ffmpeg.run(
    ..."-f s16le -ar 48k -ac 2".split(" "),
    "-i",
    "input.pcm",
    "output.wav"
  );
  const data = ffmpeg.FS("readFile", "output.wav");
  ffmpeg.FS("unlink", "input.pcm");
  ffmpeg.FS("unlink", "output.wav");
  return data;
};

const processQueue = setTimeout(async () => {
  while (convertQueue.findIndex((v) => Array.isArray(v)) !== -1) {
    const i = convertQueue.findIndex((v) => Array.isArray(v));
    const result = await convertWav(convertQueue[i] as number[]);
    convertQueue[i] = result;
  }
  processQueue.refresh();
}, 100);

const command: commandClass = {
  data: new SlashCommandBuilder()
    .setName("communication")
    .setDescription("ずんだもんとおしゃべりできます。友達料は割高。"),
  execute: async (interaction) => {
    const channel = (interaction.member as GuildMember).voice.channel;
    if (channel) {
      await interaction.reply({ content: "Pong!", ephemeral: true });
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      const encoder = new OpusEncoder(48000, 2);
      const tempBuffer: number[] = [];
      const player = connection.subscribe(createAudioPlayer());

      const createReciver = () => {
        console.log("subscribed");
        const audio = connection.receiver.subscribe(interaction.user.id, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 500,
          },
        });

        audio.on("data", (chunk) => {
          console.log("Received audio chunk: " + chunk.length + " bytes");
          tempBuffer.push(...encoder.decode(chunk));
        });
        audio.on("end", () => {
          console.log("length: " + tempBuffer.length);
          let nullIndex = convertQueue.findIndex((v) => v === null);
          if (nullIndex !== -1) {
            convertQueue[nullIndex] = tempBuffer.concat();
          } else {
            nullIndex = convertQueue.length;
            convertQueue.push(tempBuffer.concat());
          }
          tempBuffer.length = 0;

          const waitQueue = setInterval(async () => {
            if (convertQueue[nullIndex] instanceof Uint8Array) {
              clearInterval(waitQueue);
              const data = convertQueue[nullIndex] as Uint8Array;

              const form = new FormData();
              form.append("file", Buffer.from(data), {
                filename: "output.wav",
              });
              fs.writeFileSync("user_audio.wav", data);
              const res = await axios.post("http://localhost:8000/", form, {
                responseType: "stream",
              });
              convertQueue[nullIndex] = null;

              const resource = createAudioResource(res.data, {
                inputType: StreamType.Arbitrary,
              });

              player?.player.play(resource);
              createReciver();
            }
          }, 100);

          console.log("closed");
        });
      };

      createReciver();
    } else {
      interaction.reply({
        content: "You need to join a voice channel first!",
        ephemeral: true,
      });
    }
  },
};

module.exports = command;
