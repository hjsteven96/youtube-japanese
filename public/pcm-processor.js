// public/pcm-processor.js

class PcmProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.sourceSampleRate = sampleRate;
        this.targetSampleRate =
            options.processorOptions.targetSampleRate || 16000;
        this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;
    }

    process(inputs, outputs, parameters) {
        const inputChannelData = inputs[0]?.[0];
        if (!inputChannelData) {
            return true;
        }

        const newLength = Math.floor(
            inputChannelData.length / this.resampleRatio
        );
        const resampledData = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const index = i * this.resampleRatio;
            const low = Math.floor(index);
            const high = Math.ceil(index);
            const weight = index - low;
            const P = inputChannelData[low] || 0;
            const Q = inputChannelData[high] || 0;
            resampledData[i] = P * (1 - weight) + Q * weight;
        }

        const pcmData = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, resampledData[i])) * 0x7fff;
        }

        this.port.postMessage(pcmData, [pcmData.buffer]);
        return true;
    }
}

registerProcessor("pcm-processor", PcmProcessor);
