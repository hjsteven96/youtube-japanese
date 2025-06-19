// src/lib/AudioInputProcessor.ts

/**
 * 마이크 스트림을 실시간으로 16kHz PCM으로 변환하여 콜백을 통해 전송하는 클래스.
 * MediaRecorder를 사용하지 않아 더 가볍고 안정적입니다.
 */
export class AudioInputProcessor {
    private audioContext: AudioContext | null = null;
    private stream: MediaStream | null = null;
    private scriptNode: ScriptProcessorNode | null = null;
    private onPcmData: (data: string) => void;
    private readonly TARGET_SAMPLE_RATE = 16000;
    private resampleBuffer: Float32Array = new Float32Array(0);

    constructor(onPcmData: (data: string) => void) {
        this.onPcmData = onPcmData;
    }

    async start(stream: MediaStream) {
        this.stream = stream;
        this.audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)();

        const source = this.audioContext.createMediaStreamSource(this.stream);
        const bufferSize = 4096;
        this.scriptNode = this.audioContext.createScriptProcessor(
            bufferSize,
            1,
            1
        );

        this.scriptNode.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);

            // 1. 리샘플링 (선형 보간)
            const resampledData = this.resample(
                inputData,
                this.audioContext!.sampleRate,
                this.TARGET_SAMPLE_RATE
            );

            // 2. Float32 -> Int16 PCM 변환
            const int16Array = new Int16Array(resampledData.length);
            for (let i = 0; i < resampledData.length; i++) {
                int16Array[i] =
                    Math.max(-1, Math.min(1, resampledData[i])) * 0x7fff;
            }

            // 3. Base64 인코딩 및 전송
            const base64Audio = btoa(
                String.fromCharCode(...new Uint8Array(int16Array.buffer))
            );
            this.onPcmData(base64Audio);
        };

        source.connect(this.scriptNode);
        this.scriptNode.connect(this.audioContext.destination);
    }

    private resample(
        input: Float32Array,
        from: number,
        to: number
    ): Float32Array {
        if (from === to) {
            return input;
        }

        const ratio = (from - 1) / (to - 1);
        const newLength = Math.round(input.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const index = i * ratio;
            const low = Math.floor(index);
            const high = Math.ceil(index);
            const weight = index - low;

            result[i] = input[low] * (1 - weight) + input[high] * weight;
        }
        return result;
    }

    stop() {
        if (this.scriptNode) {
            this.scriptNode.disconnect();
            this.scriptNode = null;
        }
        if (this.audioContext && this.audioContext.state !== "closed") {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
