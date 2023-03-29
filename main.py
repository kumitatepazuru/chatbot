import openai
from voicevox_core import VoicevoxCore

from fastapi import FastAPI, File, UploadFile, Response

import speech_recognition as sr

app = FastAPI()
r = sr.Recognizer()
SPEAKER_ID = 3
openai.api_key = "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"
text_list = [{"role": "system", "content": "Your name is ずんだもん. Please answer the question in 100 characters or less "
                                           "in Japanese."}]


@app.post("/")
def index(file: UploadFile = File()):
    with sr.AudioFile(file.file) as source:
        audio = r.record(source)

    text = r.recognize_google(audio, language='ja-JP')
    print(text)

    text_list.append({"role": "user", "content": text})
    text = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=text_list
    )
    text_list.append({"role": "assistant", "content": text["choices"][0]["message"]["content"]})

    core = VoicevoxCore(acceleration_mode="AUTO", open_jtalk_dict_dir="open_jtalk_dic_utf_8-1.11")
    core.load_model(SPEAKER_ID)
    audio_query = core.audio_query(text["choices"][0]["message"]["content"], SPEAKER_ID)
    wav = core.synthesis(audio_query, SPEAKER_ID)
    print(text["choices"][0]["message"]["content"])
    print(text["usage"]["total_tokens"])

    return Response(wav, media_type="audio/wav")

