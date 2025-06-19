시작하기
이 예에서는 WAV 파일을 읽고 올바른 형식으로 전송한 후 수신된 데이터를 WAV 파일로 저장합니다.

오디오를 16비트 PCM, 16kHz, 모노 형식으로 변환하여 전송할 수 있으며 AUDIO를 응답 모달리티로 설정하여 오디오를 수신할 수 있습니다. 출력은 24kHz 샘플링 레이트를 사용합니다.

Python
자바스크립트

// Test file: https://storage.googleapis.com/generativeai-downloads/data/16000.wav
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';  // npm install wavefile
const { WaveFile } = pkg;

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
// WARNING: Do not use API keys in client-side (browser based) applications
// Consider using Ephemeral Tokens instead
// More information at: https://ai.google.dev/gemini-api/docs/ephemeral-tokens

// Half cascade model:
// const model = "gemini-2.0-flash-live-001"

// Native audio output model:
const model = "gemini-2.5-flash-preview-native-audio-dialog"

const config = {
  responseModalities: [Modality.AUDIO], 
  systemInstruction: "You are a helpful assistant and answer in a friendly tone."
};

async function live() {
    const responseQueue = [];

    async function waitMessage() {
        let done = false;
        let message = undefined;
        while (!done) {
            message = responseQueue.shift();
            if (message) {
                done = true;
            } else {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
        return message;
    }

    async function handleTurn() {
        const turns = [];
        let done = false;
        while (!done) {
            const message = await waitMessage();
            turns.push(message);
            if (message.serverContent && message.serverContent.turnComplete) {
                done = true;
            }
        }
        return turns;
    }

    const session = await ai.live.connect({
        model: model,
        callbacks: {
            onopen: function () {
                console.debug('Opened');
            },
            onmessage: function (message) {
                responseQueue.push(message);
            },
            onerror: function (e) {
                console.debug('Error:', e.message);
            },
            onclose: function (e) {
                console.debug('Close:', e.reason);
            },
        },
        config: config,
    });

    // Send Audio Chunk
    const fileBuffer = fs.readFileSync("sample.wav");

    // Ensure audio conforms to API requirements (16-bit PCM, 16kHz, mono)
    const wav = new WaveFile();
    wav.fromBuffer(fileBuffer);
    wav.toSampleRate(16000);
    wav.toBitDepth("16");
    const base64Audio = wav.toBase64();

    // If already in correct format, you can use this:
    // const fileBuffer = fs.readFileSync("sample.pcm");
    // const base64Audio = Buffer.from(fileBuffer).toString('base64');

    session.sendRealtimeInput(
        {
            audio: {
                data: base64Audio,
                mimeType: "audio/pcm;rate=16000"
            }
        }

    );

    const turns = await handleTurn();

    // Combine audio data strings and save as wave file
    const combinedAudio = turns.reduce((acc, turn) => {
        if (turn.data) {
            const buffer = Buffer.from(turn.data, 'base64');
            const intArray = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Int16Array.BYTES_PER_ELEMENT);
            return acc.concat(Array.from(intArray));
        }
        return acc;
    }, []);

    const audioBuffer = new Int16Array(combinedAudio);

    const wf = new WaveFile();
    wf.fromScratch(1, 24000, '16', audioBuffer);  // output is 24kHz
    fs.writeFileSync('audio.wav', wf.toBuffer());

    session.close();
}

async function main() {
    await live().catch((e) => console.error('got error', e));
}

main();


이 가이드에서는 Live API에서 사용할 수 있는 기능과 구성을 다룹니다. 일반적인 사용 사례에 관한 개요와 샘플 코드는 Live API 시작하기 페이지를 참고하세요.

시작하기 전에
핵심 개념 숙지: 아직 숙지하지 않았다면 먼저 실시간 API 시작하기 페이지를 읽어 보세요. 여기에서는 Live API의 기본 원리, 작동 방식, 다양한 모델과 해당 오디오 생성 방법 (네이티브 오디오 또는 하프 캐스케이드)의 차이점을 소개합니다.
AI 스튜디오에서 Live API 사용해 보기: 빌드를 시작하기 전에 Google AI 스튜디오에서 Live API를 사용해 보는 것이 좋습니다. Google AI Studio에서 Live API를 사용하려면 스트림을 선택합니다.
연결 설정
다음 예는 API 키로 연결을 만드는 방법을 보여줍니다.


자바스크립트

import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';
const config = { responseModalities: [Modality.TEXT] };

async function main() {

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        console.debug(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  // Send content...

  session.close();
}

main();
참고: response_modalities 필드에는 모달리티 하나만 설정할 수 있습니다. 즉, 모델이 텍스트 또는 오디오로 응답하도록 구성할 수 있지만 동일한 세션에서 둘 다 응답하도록 구성할 수는 없습니다.
상호작용 모달리티
다음 섹션에서는 Live API에서 사용할 수 있는 다양한 입력 및 출력 모달에 관한 예시와 지원 컨텍스트를 제공합니다.

문자 메시지 주고받기
다음은 텍스트를 보내고 받는 방법입니다.

Python
자바스크립트

import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';
const config = { responseModalities: [Modality.TEXT] };

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  const inputTurns = 'Hello how are you?';
  session.sendClientContent({ turns: inputTurns });

  const turns = await handleTurn();
  for (const turn of turns) {
    if (turn.text) {
      console.debug('Received text: %s\n', turn.text);
    }
    else if (turn.data) {
      console.debug('Received inline data: %s\n', turn.data);
    }
  }

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
증분 콘텐츠 업데이트
증분 업데이트를 사용하여 텍스트 입력을 전송하거나, 세션 컨텍스트를 설정하거나, 세션 컨텍스트를 복원합니다. 짧은 컨텍스트의 경우 정확한 이벤트 순서를 나타내기 위해 차례대로 상호작용을 보낼 수 있습니다.

Python
자바스크립트
let inputTurns = [
  { "role": "user", "parts": [{ "text": "What is the capital of France?" }] },
  { "role": "model", "parts": [{ "text": "Paris" }] },
]

session.sendClientContent({ turns: inputTurns, turnComplete: false })

inputTurns = [{ "role": "user", "parts": [{ "text": "What is the capital of Germany?" }] }]

session.sendClientContent({ turns: inputTurns, turnComplete: true })
컨텍스트가 긴 경우 후속 상호작용을 위해 컨텍스트 윈도우를 확보할 수 있도록 단일 메시지 요약을 제공하는 것이 좋습니다. 세션 컨텍스트를 로드하는 다른 메서드는 세션 재개를 참고하세요.

오디오 주고받기
가장 일반적인 오디오 예인 오디오 대 오디오는 시작 가이드에서 다룹니다.

다음은 WAV 파일을 읽고 올바른 형식으로 전송하며 텍스트 출력을 수신하는 오디오 대 텍스트 예입니다.

Python
자바스크립트
// Test file: https://storage.googleapis.com/generativeai-downloads/data/16000.wav
// Install helpers for converting files: npm install wavefile
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';
const { WaveFile } = pkg;

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';
const config = { responseModalities: [Modality.TEXT] };

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  // Send Audio Chunk
  const fileBuffer = fs.readFileSync("sample.wav");

  // Ensure audio conforms to API requirements (16-bit PCM, 16kHz, mono)
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);
  wav.toSampleRate(16000);
  wav.toBitDepth("16");
  const base64Audio = wav.toBase64();

  // If already in correct format, you can use this:
  // const fileBuffer = fs.readFileSync("sample.pcm");
  // const base64Audio = Buffer.from(fileBuffer).toString('base64');

  session.sendRealtimeInput(
    {
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000"
      }
    }

  );

  const turns = await handleTurn();
  for (const turn of turns) {
    if (turn.text) {
      console.debug('Received text: %s\n', turn.text);
    }
    else if (turn.data) {
      console.debug('Received inline data: %s\n', turn.data);
    }
  }

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
다음은 텍스트 음성 변환의 예입니다. AUDIO를 응답 모달리티로 설정하여 오디오를 수신할 수 있습니다. 이 예에서는 수신된 데이터를 WAV 파일로 저장합니다.

Python
자바스크립트
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';
const { WaveFile } = pkg;

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';
const config = { responseModalities: [Modality.AUDIO] };

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  const inputTurns = 'Hello how are you?';
  session.sendClientContent({ turns: inputTurns });

  const turns = await handleTurn();

  // Combine audio data strings and save as wave file
  const combinedAudio = turns.reduce((acc, turn) => {
    if (turn.data) {
      const buffer = Buffer.from(turn.data, 'base64');
      const intArray = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Int16Array.BYTES_PER_ELEMENT);
      return acc.concat(Array.from(intArray));
    }
    return acc;
  }, []);

  const audioBuffer = new Int16Array(combinedAudio);

  const wf = new WaveFile();
  wf.fromScratch(1, 24000, '16', audioBuffer);
  fs.writeFileSync('output.wav', wf.toBuffer());

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
오디오 형식
Live API의 오디오 데이터는 항상 원시 리틀 엔디언 16비트 PCM입니다. 오디오 출력은 항상 24kHz 샘플링 레이트를 사용합니다. 입력 오디오는 기본적으로 16kHz이지만 Live API는 필요한 경우 샘플링 레이트를 리샘플링하므로 어떤 샘플링 레이트도 전송할 수 있습니다. 입력 오디오의 샘플링 레이트를 전달하려면 각 오디오 포함 Blob의 MIME 유형을 audio/pcm;rate=16000과 같은 값으로 설정합니다.

오디오 스크립트
설정 구성에서 output_audio_transcription를 전송하여 모델의 오디오 출력 스크립트 작성을 사용 설정할 수 있습니다. 스크립트 작성 언어는 모델의 응답에서 추론됩니다.

Python
자바스크립트
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';

const config = {
  responseModalities: [Modality.AUDIO],
  outputAudioTranscription: {}
};

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  const inputTurns = 'Hello how are you?';
  session.sendClientContent({ turns: inputTurns });

  const turns = await handleTurn();

  for (const turn of turns) {
    if (turn.serverContent && turn.serverContent.outputTranscription) {
      console.debug('Received output transcription: %s\n', turn.serverContent.outputTranscription.text);
    }
  }

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
설정 구성에서 input_audio_transcription를 전송하여 오디오 입력의 스크립트 작성을 사용 설정할 수 있습니다.

Python
자바스크립트
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';
const { WaveFile } = pkg;

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';

const config = {
  responseModalities: [Modality.TEXT],
  inputAudioTranscription: {}
};

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  // Send Audio Chunk
  const fileBuffer = fs.readFileSync("16000.wav");

  // Ensure audio conforms to API requirements (16-bit PCM, 16kHz, mono)
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);
  wav.toSampleRate(16000);
  wav.toBitDepth("16");
  const base64Audio = wav.toBase64();

  // If already in correct format, you can use this:
  // const fileBuffer = fs.readFileSync("sample.pcm");
  // const base64Audio = Buffer.from(fileBuffer).toString('base64');

  session.sendRealtimeInput(
    {
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000"
      }
    }
  );

  const turns = await handleTurn();

  for (const turn of turns) {
    if (turn.serverContent && turn.serverContent.outputTranscription) {
      console.log("Transcription")
      console.log(turn.serverContent.outputTranscription.text);
    }
  }
  for (const turn of turns) {
    if (turn.text) {
      console.debug('Received text: %s\n', turn.text);
    }
    else if (turn.data) {
      console.debug('Received inline data: %s\n', turn.data);
    }
    else if (turn.serverContent && turn.serverContent.inputTranscription) {
      console.debug('Received input transcription: %s\n', turn.serverContent.inputTranscription.text);
    }
  }

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
오디오 및 동영상 스트리밍
스트리밍 오디오 및 동영상 형식에서 Live API를 사용하는 방법의 예를 보려면 cookbooks 저장소에서 'Live API - 시작하기' 파일을 실행하세요.

GitHub에서 보기

음성 및 언어 변경하기
Live API 모델은 각각 서로 다른 음성 세트를 지원합니다. 하프 캐스케이드는 Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr를 지원합니다. 네이티브 오디오는 훨씬 더 긴 목록을 지원합니다 (TTS 모델 목록과 동일). AI 스튜디오에서 모든 음성을 들을 수 있습니다.

음성을 지정하려면 세션 구성의 일부로 speechConfig 객체 내에서 음성 이름을 설정합니다.

Python
자바스크립트
const config = {
  responseModalities: [Modality.AUDIO],
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
};
참고: generateContent API를 사용하는 경우 사용 가능한 음성 세트가 약간 다릅니다. generateContent 오디오 생성 음성은 오디오 생성 가이드를 참고하세요.
Live API는 다국어를 지원합니다.

언어를 변경하려면 세션 구성의 일부로 speechConfig 객체 내에서 언어 코드를 설정합니다.

Python
자바스크립트
const config = {
  responseModalities: [Modality.AUDIO],
  speechConfig: { languageCode: "de-DE" }
};
참고: 네이티브 오디오 출력 모델은 적절한 언어를 자동으로 선택하며 언어 코드의 명시적 설정을 지원하지 않습니다.
네이티브 오디오 기능
다음 기능은 네이티브 오디오에서만 사용할 수 있습니다. 모델 및 오디오 생성 선택에서 네이티브 오디오에 대해 자세히 알아보세요.

참고: 현재 네이티브 오디오 모델은 도구 사용 지원이 제한적입니다. 자세한 내용은 지원되는 도구 개요를 참고하세요.
네이티브 오디오 출력 사용 방법
네이티브 오디오 출력을 사용하려면 네이티브 오디오 모델 중 하나를 구성하고 response_modalities를 AUDIO로 설정합니다.

전체 예시는 오디오 보내기 및 받기를 참고하세요.

Python
자바스크립트
const model = 'gemini-2.5-flash-preview-native-audio-dialog';
const config = { responseModalities: [Modality.AUDIO] };

async function main() {

  const session = await ai.live.connect({
    model: model,
    config: config,
    callbacks: ...,
  });

  // Send audio input and receive audio

  session.close();
}

main();
공감형 대화
이 기능을 사용하면 Gemini가 입력된 표현과 말투에 맞게 대답 스타일을 조정할 수 있습니다.

감정 대화를 사용하려면 API 버전을 v1alpha로 설정하고 설정 메시지에서 enable_affective_dialog를 true로 설정합니다.

Python
자바스크립트
const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY", httpOptions: {"apiVersion": "v1alpha"} });

const config = {
  responseModalities: [Modality.AUDIO],
  enableAffectiveDialog: true
};
감정 대화는 현재 네이티브 오디오 출력 모델에서만 지원됩니다.

능동적 오디오
이 기능을 사용 설정하면 Gemini는 콘텐츠가 관련이 없는 경우 사전에 응답하지 않기로 결정할 수 있습니다.

이를 사용하려면 API 버전을 v1alpha로 설정하고 설정 메시지에서 proactivity 필드를 구성한 다음 proactive_audio를 true로 설정합니다.

Python
자바스크립트
const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY", httpOptions: {"apiVersion": "v1alpha"} });

const config = {
  responseModalities: [Modality.AUDIO],
  proactivity: { proactiveAudio: true }
}
사전 예방적 오디오는 현재 네이티브 오디오 출력 모델에서만 지원됩니다.

사고를 통한 네이티브 오디오 출력
네이티브 오디오 출력은 별도의 모델 gemini-2.5-flash-exp-native-audio-thinking-dialog를 통해 사용할 수 있는 생각 기능을 지원합니다.

전체 예시는 오디오 보내기 및 받기를 참고하세요.

Python
자바스크립트
const model = 'gemini-2.5-flash-exp-native-audio-thinking-dialog';
const config = { responseModalities: [Modality.AUDIO] };

async function main() {

  const session = await ai.live.connect({
    model: model,
    config: config,
    callbacks: ...,
  });

  // Send audio input and receive audio

  session.close();
}

main();
음성 활동 감지 (VAD)
음성 활동 감지 (VAD)를 사용하면 모델이 사람이 말하는 시점을 인식할 수 있습니다. 이는 사용자가 언제든지 모델을 중단할 수 있으므로 자연스러운 대화를 만드는 데 필수적입니다.

VAD가 중단을 감지하면 진행 중인 생성이 취소되고 삭제됩니다. 이미 클라이언트로 전송된 정보만 세션 기록에 유지됩니다. 그러면 서버는 중단을 보고하기 위해 BidiGenerateContentServerContent 메시지를 전송합니다.

그러면 Gemini 서버는 대기 중인 함수 호출을 모두 삭제하고 취소된 호출의 ID가 포함된 BidiGenerateContentServerContent 메시지를 전송합니다.

Python
자바스크립트
const turns = await handleTurn();

for (const turn of turns) {
  if (turn.serverContent && turn.serverContent.interrupted) {
    // The generation was interrupted

    // If realtime playback is implemented in your application,
    // you should stop playing audio and clear queued playback here.
  }
}
자동 VAD
기본적으로 이 모델은 연속 오디오 입력 스트림에서 VAD를 자동으로 실행합니다. VAD는 설정 구성의 realtimeInputConfig.automaticActivityDetection 필드로 구성할 수 있습니다.

오디오 스트림이 1초 이상 일시중지되면 (예: 사용자가 마이크를 껐기 때문에) 캐시된 오디오를 플러시하기 위해 audioStreamEnd 이벤트를 전송해야 합니다. 클라이언트는 언제든지 오디오 데이터 전송을 재개할 수 있습니다.

Python
자바스크립트
// example audio file to try:
// URL = "https://storage.googleapis.com/generativeai-downloads/data/hello_are_you_there.pcm"
// !wget -q $URL -O sample.pcm
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const model = 'gemini-2.0-flash-live-001';
const config = { responseModalities: [Modality.TEXT] };

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

  // Send Audio Chunk
  const fileBuffer = fs.readFileSync("sample.pcm");
  const base64Audio = Buffer.from(fileBuffer).toString('base64');

  session.sendRealtimeInput(
    {
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000"
      }
    }

  );

  // if stream gets paused, send:
  // session.sendRealtimeInput({ audioStreamEnd: true })

  const turns = await handleTurn();
  for (const turn of turns) {
    if (turn.text) {
      console.debug('Received text: %s\n', turn.text);
    }
    else if (turn.data) {
      console.debug('Received inline data: %s\n', turn.data);
    }
  }

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
send_realtime_input를 사용하면 API가 VAD를 기반으로 오디오에 자동으로 응답합니다. send_client_content는 순서대로 모델 컨텍스트에 메시지를 추가하는 반면 send_realtime_input는 결정론적 순서를 희생하여 응답성에 최적화되어 있습니다.

자동 VAD 구성
VAD 활동을 더 세부적으로 제어하려면 다음 매개변수를 구성하세요. 자세한 내용은 API 참조를 참고하세요.

Python
자바스크립트
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from '@google/genai';

const config = {
  responseModalities: [Modality.TEXT],
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: false, // default
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 20,
      silenceDurationMs: 100,
    }
  }
};
자동 VAD 사용 중지
또는 설정 메시지에서 realtimeInputConfig.automaticActivityDetection.disabled를 true로 설정하여 자동 VAD를 사용 중지할 수 있습니다. 이 구성에서 클라이언트는 사용자 음성을 감지하고 적절한 시점에 activityStart 및 activityEnd 메시지를 전송합니다. 이 구성에서는 audioStreamEnd가 전송되지 않습니다. 대신 스트림이 중단되면 activityEnd 메시지로 표시됩니다.

Python
자바스크립트
const config = {
  responseModalities: [Modality.TEXT],
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: true,
    }
  }
};

session.sendRealtimeInput({ activityStart: {} })

session.sendRealtimeInput(
  {
    audio: {
      data: base64Audio,
      mimeType: "audio/pcm;rate=16000"
    }
  }

);

session.sendRealtimeInput({ activityEnd: {} })
토큰 수
소비된 총 토큰 수는 반환된 서버 메시지의 usageMetadata 필드에서 확인할 수 있습니다.

Python
자바스크립트
const turns = await handleTurn();

for (const turn of turns) {
  if (turn.usageMetadata) {
    console.debug('Used %s tokens in total. Response token breakdown:\n', turn.usageMetadata.totalTokenCount);

    for (const detail of turn.usageMetadata.responseTokensDetails) {
      console.debug('%s\n', detail);
    }
  }
}
미디어 해상도
mediaResolution 필드를 세션 구성의 일부로 설정하여 입력 미디어의 미디어 해상도를 지정할 수 있습니다.

Python
자바스크립트
import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';

const config = {
    responseModalities: [Modality.TEXT],
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
};
제한사항
프로젝트를 계획할 때는 Live API의 다음 제한사항을 고려하세요.

응답 방식
세션 구성에서 세션당 응답 모드 (TEXT 또는 AUDIO)를 하나만 설정할 수 있습니다. 둘 다 설정하면 구성 오류 메시지가 표시됩니다. 즉, 동일한 세션에서 텍스트 또는 오디오 중 하나로 응답하도록 모델을 구성할 수 있지만 둘 다를 사용할 수는 없습니다.

클라이언트 인증
Live API는 기본적으로 서버 간 인증만 제공합니다. 클라이언트-서버 접근 방식을 사용하여 실시간 API 애플리케이션을 구현하는 경우 임시 토큰을 사용하여 보안 위험을 완화해야 합니다.

세션 시간
오디오 전용 세션은 15분으로 제한되며 오디오 및 동영상 세션은 2분으로 제한됩니다. 하지만 세션 시간을 무제한으로 연장할 수 있도록 다양한 세션 관리 기법을 구성할 수 있습니다.

컨텍스트 윈도우
세션의 컨텍스트 기간 제한은 다음과 같습니다.

네이티브 오디오 출력 모델의 경우 128,000개 토큰
다른 Live API 모델의 경우 32,000개 토큰
지원 언어
Live API는 다음 언어를 지원합니다.

참고: 네이티브 오디오 출력 모델은 적절한 언어를 자동으로 선택하며 언어 코드의 명시적 설정을 지원하지 않습니다.
언어	BCP-47 코드	언어	BCP-47 코드
독일어(독일)	de-DE	영어 (오스트레일리아)*	en-AU
영어 (영국)*	en-GB	영어(인도)	en-IN
영어(미국)	en-US	스페인어(미국)	es-US
프랑스어(프랑스)	fr-FR	힌디어(인도)	hi-IN
포르투갈어(브라질)	pt-BR	아랍어(일반)	ar-XA
스페인어 (스페인)*	es-ES	프랑스어 (캐나다)*	fr-CA
인도네시아어(인도네시아)	id-ID	이탈리아어(이탈리아)	it-IT
일본어(일본)	ja-JP	터키어(터키)	tr-TR
베트남어(베트남)	vi-VN	벵골어(인도)	bn-IN
구자라트어 (인도)*	gu-IN	칸나다어 (인도)*	kn-IN
마라티어(인도)	mr-IN	말라얄람어 (인도)*	ml-IN
타밀어(인도)	ta-IN	텔루구어(인도)	te-IN
네덜란드어(네덜란드)	nl-NL	한국어(대한민국)	ko-KR
중국어(북경어)(중국)*	cmn-CN	폴란드어(폴란드)	pl-PL
러시아어(러시아)	ru-RU	태국어(태국)	th-TH
별표 (*)로 표시된 언어는 네이티브 오디오에 사용할 수 없습니다.


Session management with Live API

Live API에서 세션은 입력과 출력이 동일한 연결을 통해 연속으로 스트리밍되는 영구 연결을 의미합니다 (작동 방식 자세히 알아보기). 이 고유한 세션 설계는 지연 시간을 줄이고 고유한 기능을 지원하지만 세션 시간 제한, 조기 종료와 같은 문제가 발생할 수도 있습니다. 이 가이드에서는 Live API를 사용할 때 발생할 수 있는 세션 관리 문제를 해결하기 위한 전략을 다룹니다.

세션 수명
압축을 사용하지 않으면 오디오 전용 세션은 15분으로 제한되고 오디오-동영상 세션은 2분으로 제한됩니다. 이 한도를 초과하면 세션 (및 연결)이 종료되지만 컨텍스트 창 압축을 사용하여 세션을 무제한으로 연장할 수 있습니다.

연결의 전체 기간도 약 10분으로 제한됩니다. 연결이 종료되면 세션도 종료됩니다. 이 경우 세션 재개를 사용하여 여러 연결에서 활성 상태를 유지하도록 단일 세션을 구성할 수 있습니다. 연결이 종료되기 전에 GoAway 메시지도 수신되므로 추가 조치를 취할 수 있습니다.

컨텍스트 윈도우 압축
세션을 더 길게 사용하고 갑작스러운 연결 종료를 방지하려면 contextWindowCompression 필드를 세션 구성의 일부로 설정하여 컨텍스트 창 압축을 사용 설정할 수 있습니다.

ContextWindowCompressionConfig에서 슬라이딩 창 메커니즘과 압축을 트리거하는 토큰 수를 구성할 수 있습니다.

Python
자바스크립트

const config = {
  responseModalities: [Modality.AUDIO],
  contextWindowCompression: { slidingWindow: {} }
};
세션 재개
서버가 주기적으로 WebSocket 연결을 재설정할 때 세션 종료를 방지하려면 설정 구성 내에서 sessionResumption 필드를 구성합니다.

이 구성을 전달하면 서버가 SessionResumptionUpdate 메시지를 전송합니다. 이 메시지는 마지막 재개 토큰을 후속 연결의 SessionResumptionConfig.handle로 전달하여 세션을 재개하는 데 사용할 수 있습니다.

Python
자바스크립트

import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
const model = 'gemini-2.0-flash-live-001';

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

console.debug('Connecting to the service with handle %s...', previousSessionHandle)
const session = await ai.live.connect({
  model: model,
  callbacks: {
    onopen: function () {
      console.debug('Opened');
    },
    onmessage: function (message) {
      responseQueue.push(message);
    },
    onerror: function (e) {
      console.debug('Error:', e.message);
    },
    onclose: function (e) {
      console.debug('Close:', e.reason);
    },
  },
  config: {
    responseModalities: [Modality.TEXT],
    sessionResumption: { handle: previousSessionHandle }
    // The handle of the session to resume is passed here, or else null to start a new session.
  }
});

const inputTurns = 'Hello how are you?';
session.sendClientContent({ turns: inputTurns });

const turns = await handleTurn();
for (const turn of turns) {
  if (turn.sessionResumptionUpdate) {
    if (turn.sessionResumptionUpdate.resumable && turn.sessionResumptionUpdate.newHandle) {
      let newHandle = turn.sessionResumptionUpdate.newHandle
      // ...Store newHandle and start new session with this handle here
    }
  }
}

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
세션 연결이 끊기기 전에 메시지 수신
서버는 현재 연결이 곧 종료됨을 알리는 GoAway 메시지를 전송합니다. 이 메시지에는 남은 시간을 나타내는 timeLeft가 포함되며, 연결이 ABORTED로 종료되기 전에 추가 조치를 취할 수 있습니다.

Python
자바스크립트

const turns = await handleTurn();

for (const turn of turns) {
  if (turn.goAway) {
    console.debug('Time left: %s\n', turn.goAway.timeLeft);
  }
}
생성이 완료되면 메시지 수신
서버는 모델이 응답 생성을 완료했음을 알리는 generationComplete 메시지를 전송합니다.

Python
자바스크립트

const turns = await handleTurn();

for (const turn of turns) {
  if (turn.serverContent && turn.serverContent.generationComplete) {
    // The generation is complete
  }
}

임시 토큰의 작동 방식
일회용 토큰의 대략적인 작동 방식은 다음과 같습니다.

클라이언트 (예: 웹 앱)가 백엔드와 인증합니다.
백엔드가 Gemini API의 프로비저닝 서비스에서 임시 토큰을 요청합니다.
Gemini API는 단기 토큰을 발급합니다.
백엔드는 Live API에 대한 WebSocket 연결을 위해 클라이언트로 토큰을 전송합니다. API 키를 임시 토큰으로 전환하면 됩니다.
그러면 클라이언트는 토큰을 API 키처럼 사용합니다.
임시 토큰 개요

이렇게 하면 추출되더라도 클라이언트 측에 배포된 장기 API 키와 달리 토큰이 단기적이므로 보안이 강화됩니다. 클라이언트가 데이터를 Gemini로 직접 전송하므로 지연 시간도 개선되고 백엔드에서 실시간 데이터를 프록시할 필요가 없습니다.

임시 토큰 만들기
다음은 Gemini에서 일회용 토큰을 가져오는 방법을 보여주는 간단한 예입니다. 기본적으로 이 요청의 토큰 (newSessionExpireTime)을 사용하여 새 실시간 API 세션을 시작하는 데 1분, 해당 연결 (expireTime)을 통해 메시지를 전송하는 데 30분이 소요됩니다.

Python
자바스크립트

import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const token: AuthToken = await client.authTokens.create({
    config: {
      uses: 1, // The default
      expireTime: expireTime // Default is 30 mins
      newSessionExpireTime: new Date(Date.now() + (1 * 60 * 1000)), // Default 1 minute in the future
      httpOptions: {apiVersion: 'v1alpha'},
    },
  });
expireTime 값 제약 조건, 기본값, 기타 필드 사양은 API 참조를 참고하세요. expireTime 기간 내에 10분마다 통화를 다시 연결하려면 sessionResumption를 사용해야 합니다 (uses: 1인 경우에도 동일한 토큰으로 실행할 수 있음).

일시적인 토큰을 구성 집합에 잠글 수도 있습니다. 이는 애플리케이션의 보안을 더욱 강화하고 시스템 안내를 서버 측에 유지하는 데 유용할 수 있습니다.

Python
자바스크립트

import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });
const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

const token = await client.authTokens.create({
    config: {
        uses: 1, // The default
        expireTime: expireTime,
        liveConnectConstraints: {
            model: 'gemini-2.0-flash-live-001',
            config: {
                sessionResumption: {},
                temperature: 0.7,
                responseModalities: ['TEXT']
            }
        },
        httpOptions: {
            apiVersion: 'v1alpha'
        }
    }
});

// You'll need to pass the value under token.name back to your client to use it
필드의 하위 집합을 잠글 수도 있습니다. 자세한 내용은 SDK 문서를 참고하세요.

일회용 토큰으로 Live API에 연결
다음은 임시 토큰을 통해 실시간 API에 연결하는 예입니다. 일시적인 토큰을 사용하면 클라이언트-서버 구현 접근 방식을 따르는 애플리케이션을 배포할 때만 가치가 추가됩니다.

자바스크립트

import { GoogleGenAI, Modality } from '@google/genai';

// Use the token generated in the "Create an ephemeral token" section here
const ai = new GoogleGenAI({ apiKey: token.name });
const model = 'gemini-2.0-flash-live-001';
const config = { responseModalities: [Modality.TEXT] };

async function main() {

  const session = await ai.live.connect({
    model: model,
    config: config,
    callbacks: { ... },
  });

  // Send content...

  session.close();
}

main();
참고: SDK를 사용하지 않는 경우 임시 토큰은 access_token 쿼리 매개변수로 전달되거나 auth-scheme Token 접두사가 있는 HTTP Authorization로 전달되어야 합니다.
추가 예시는 Live API 시작하기를 참고하세요.

권장사항
expire_time 매개변수를 사용하여 짧은 만료 기간을 설정합니다.
토큰이 만료되어 프로비저닝 프로세스를 다시 시작해야 합니다.
자체 백엔드의 보안 인증을 확인합니다. 임시 토큰은 백엔드 인증 방법만큼만 안전합니다.
일반적으로 백엔드-Gemini 연결에는 임시 토큰을 사용하지 않는 것이 좋습니다. 이 경로는 일반적으로 안전하다고 간주되기 때문입니다.
제한사항
임시 토큰은 현재 실시간 API와만 호환됩니다.