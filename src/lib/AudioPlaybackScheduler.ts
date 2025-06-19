// src/lib/AudioPlaybackScheduler.ts

/**
 * Web Audio API를 사용하여 오디오 청크를 끊김 없이 예약하고 재생하는 클래스.
 */
export class AudioPlaybackScheduler {
    private audioContext: AudioContext;
    private nextPlayTime: number = 0;
    private audioQueue: Float32Array[] = [];
    private isPlaying: boolean = false;
    private readonly SAMPLE_RATE = 24000;

    constructor() {
        this.audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)({
            sampleRate: this.SAMPLE_RATE,
        });
    }

    /**
     * Base64로 인코딩된 PCM 오디오 데이터를 큐에 추가하고 재생을 예약합니다.
     * @param audioDataB64 - Base64 인코딩된 16비트 PCM 오디오 데이터
     */
    public add(audioDataB64: string) {
        // 1. Base64 -> Int16 -> Float32 변환
        const binaryString = atob(audioDataB64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32767.0; // -1.0에서 1.0으로 정규화
        }

        this.audioQueue.push(float32Array);
        this.schedulePlayback();
    }

    private async schedulePlayback() {
        if (this.isPlaying || this.audioQueue.length === 0) {
            return;
        }
        this.isPlaying = true;

        if (this.audioContext.state === "suspended") {
            await this.audioContext.resume();
        }

        // 현재 재생이 예약된 시간과 실제 시간 중 더 큰 값을 기준으로 다음 재생 시작 시간을 정합니다.
        // 이렇게 하면 지연이 발생해도 오디오가 겹치지 않습니다.
        const currentTime = this.audioContext.currentTime;
        if (this.nextPlayTime < currentTime) {
            this.nextPlayTime = currentTime;
        }

        while (this.audioQueue.length > 0) {
            const pcmData = this.audioQueue.shift()!;
            const audioBuffer = this.audioContext.createBuffer(
                1,
                pcmData.length,
                this.SAMPLE_RATE
            );
            audioBuffer.getChannelData(0).set(pcmData);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);

            source.start(this.nextPlayTime);

            // 현재 버퍼의 재생 시간만큼 다음 재생 시간을 뒤로 미룹니다.
            this.nextPlayTime += audioBuffer.duration;
        }

        this.isPlaying = false;
    }

    /**
     * 모든 예약된 재생을 중지하고 리소스를 정리합니다.
     */
    public stop() {
        if (this.audioContext.state !== "closed") {
            this.audioContext.close().catch(console.error);
        }
    }
}
