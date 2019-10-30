from django.shortcuts import render
from django.http import JsonResponse
import numpy as np
from python_speech_features import mfcc, logfbank
import os
from django.conf import settings
from pydub import AudioSegment
import speech_recognition as sr
import re
from unidecode import unidecode
from math import ceil
from django.views.decorators.csrf import csrf_exempt

def index(request):
    return render(request, 'emotions/index.html', {})

def rgb2gray(rgb):
    return [round(rgb[i-2]*0.299+rgb[i-1]*0.587+rgb[i]*0.114) for i in range(2,len(rgb),3)]
    
@csrf_exempt 
def analyze_audio(request):
    audio = request.POST.get('audio')
    audio = np.asarray(np.asarray(audio.split(","), dtype=np.float32) * 10000, dtype=np.int16)
    #Audio
    mel = np.transpose(mfcc(audio, 48000, nfft=2048))
    lfe = np.transpose(logfbank(audio, 48000, nfft=2048))
    melMax = np.max(mel)
    melMin = np.min(mel)
    lfeMax = np.max(lfe)
    lfeMin = np.min(lfe)
    mel = (mel-melMin)/(melMax-melMin)
    lfe = (lfe-lfeMin)/(lfeMax-lfeMin)
    particiones = [i*200 for i in range(1, ceil(mel.shape[1] / 200))]
    particionesAudio = [int(p * len(audio) / mel.shape[1]) for p in particiones]
    mel = np.split(mel, particiones, axis=1)
    lfe = np.split(lfe, particiones, axis=1)
    audioPart = np.split(np.absolute(audio), particionesAudio)
    i = 0
    
    while i < len(lfe):
        if np.sum(audioPart[i]) < 10*len(audioPart[i]):
            del lfe[i]
            del mel[i]
            del audioPart[i]
            #print("Se ha descartado el fragmento", i)
        else:
            i += 1
    if len(mel) == 0:
        return JsonResponse({"audio": "", "texto": ""})
    falta = 200 - mel[-1].shape[1]
    mel[-1] = [np.concatenate((fila,[0]*falta)) for fila in mel[-1]]
    lfe[-1] = [np.concatenate((fila,[0]*falta)) for fila in lfe[-1]]
    mel = np.expand_dims(mel, axis=3)
    lfe = np.expand_dims(lfe, axis=3)
    audioprediction = settings.AUDIOMODEL.predict([mel, lfe])
    
    #Texto
    sound = AudioSegment(
        data=audio.tobytes(),
        sample_width=2,
        frame_rate=48000,
        channels=1
    )                            
    i = 0
    while os.path.isfile("lea" + str(i) + ".wav"):
        i += 1                 
    AUDIO_FILE = "lea" + str(i) + ".wav"
    sound.export(AUDIO_FILE, format="wav")                                 
    r = sr.Recognizer()
    with sr.AudioFile(AUDIO_FILE) as source:
        audio = r.record(source)  # read the entire audio file 
        try:
            text = r.recognize_google(audio, language="es-ES")
            print("Transcripción:", text)
        except:
            text = ""
            print("No se ha reconocido nada")
    os.remove(AUDIO_FILE)

    if len(text) > 0:
        text = re.sub(r'[.,:;?¿!¡"\'/()”“+#-_]', ' ', text).lower().split()
        embeddedText = []
        for embeddings, k, unidecodek in [
            (settings.FASTTEXT_EMB,settings.FASTTEXT_K,settings.U_FASTTEXT_K), 
            (settings.WIKI_EMB,settings.WIKI_K,settings.U_WIKI_K),
            (settings.GLOVE_EMB,settings.GLOVE_K,settings.U_GLOVE_K),
            (settings.SBW_EMB,settings.SBW_K,settings.U_SBW_K)]:
            embeddedText.append([])
            for w in text:
                if w in k:
                    embeddedText[-1].append(embeddings[w][-300:])
                elif w in unidecodek:
                    ind = unidecodek.index(w)
                    embeddedText[-1].append(embeddings[k[ind]][-300:])
                elif unidecode(w) in k:
                    embeddedText[-1].append(embeddings[unidecode(w)][-300:])
                elif unidecode(w) in unidecodek:
                    ind = unidecodek.index(unidecode(w))
                    embeddedText[-1].append(embeddings[k[ind]][-300:])
                else:
                    embeddedText[-1].append([0.]*300)
            while len(embeddedText[-1]) < 30:
                embeddedText[-1].append([0.]*300)
        emb = np.expand_dims(np.reshape(embeddedText, (30,300,4)), axis=0)
        emb1 = np.expand_dims(embeddedText[0], axis=0)
        emb2 = np.expand_dims(embeddedText[1], axis=0) 
        textprediction1 = settings.TEXTOLSTMMODEL.predict([emb1, emb2])
        textprediction2 = settings.TEXTOCNNMODEL.predict(emb)
        textprediction = textprediction1[0]*0.9 + textprediction2[0]
    else:
        textprediction = []

    #Predicciones
    str_audio = ",".join(map(str,np.mean(audioprediction, axis=0)))
    str_texto = ",".join(map(str,textprediction))
    return JsonResponse({"audio": str_audio, "texto": str_texto})
