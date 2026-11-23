#include "public.sdk/source/vst/vstsinglecomponenteffect.h"
#include "public.sdk/source/main/pluginfactory.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/base/ustring.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "AetherForgeProcessor.h"

#include <cmath>
#include <cstdio>
#include <cstring>

namespace Steinberg::Vst {

namespace {
constexpr ParamID kParamGainId = 0;
constexpr ParamID kParamBypassId = 1;
constexpr float kMinGainDb = -60.0f;
constexpr float kMaxGainDb = 24.0f;

constexpr float normalizedToGainDb(ParamValue norm) noexcept {
    const double clamped = norm < 0.0 ? 0.0 : (norm > 1.0 ? 1.0 : norm);
    return kMinGainDb + static_cast<float>(clamped) * (kMaxGainDb - kMinGainDb);
}

constexpr ParamValue gainDbToNormalized(float db) noexcept {
    const float clamped = db < kMinGainDb ? kMinGainDb : (db > kMaxGainDb ? kMaxGainDb : db);
    return static_cast<ParamValue>((clamped - kMinGainDb) / (kMaxGainDb - kMinGainDb));
}
} // namespace

class AetherForgeGainParam final : public Parameter {
public:
    AetherForgeGainParam() {
        Steinberg::UString(info.title, USTRINGSIZE(info.title)).assign(USTRING("Gain"));
        Steinberg::UString(info.shortTitle, USTRINGSIZE(info.shortTitle)).assign(USTRING("Gain"));
        Steinberg::UString(info.units, USTRINGSIZE(info.units)).assign(USTRING("dB"));
        info.id = kParamGainId;
        info.stepCount = 0;
        info.defaultNormalizedValue = gainDbToNormalized(0.0f);
        info.unitId = kRootUnitId;
        info.flags = ParameterInfo::kCanAutomate;
        setNormalized(info.defaultNormalizedValue);
    }

    void toString(ParamValue normValue, String128 string) const SMTG_OVERRIDE {
        char buf[32]{};
        std::snprintf(buf, sizeof(buf), "%.2f", static_cast<double>(normalizedToGainDb(normValue)));
        Steinberg::UString(string, 128).fromAscii(buf);
    }

    bool fromString(const TChar* string, ParamValue& normValue) const SMTG_OVERRIDE {
        Steinberg::UString wrapper(const_cast<TChar*>(string), -1);
        double parsedDb = 0.0;
        if (wrapper.scanFloat(parsedDb)) {
            normValue = gainDbToNormalized(static_cast<float>(parsedDb));
            return true;
        }
        return false;
    }
};

class AetherForgeVst3Effect final : public SingleComponentEffect {
public:
    AetherForgeVst3Effect() = default;

    static FUnknown* createInstance(void* /*context*/) {
        return static_cast<IAudioProcessor*>(new AetherForgeVst3Effect());
    }

    tresult PLUGIN_API initialize(FUnknown* context) SMTG_OVERRIDE {
        const tresult res = SingleComponentEffect::initialize(context);
        if (res != kResultOk) {
            return res;
        }

        addAudioInput(STR16("Stereo In"), SpeakerArr::kStereo);
        addAudioOutput(STR16("Stereo Out"), SpeakerArr::kStereo);

        parameters.addParameter(new AetherForgeGainParam());
        parameters.addParameter(
            USTRING("Bypass"),
            nullptr,
            1,
            0.0,
            ParameterInfo::kCanAutomate | ParameterInfo::kIsBypass,
            kParamBypassId);

        core_.setGainDb(0.0f);
        core_.setBypass(false);
        return kResultOk;
    }

    tresult PLUGIN_API setBusArrangements(
        SpeakerArrangement* inputs,
        int32 numIns,
        SpeakerArrangement* outputs,
        int32 numOuts) SMTG_OVERRIDE {
        if (numIns == 1 && numOuts == 1 && inputs != nullptr && outputs != nullptr &&
            inputs[0] == outputs[0] &&
            (inputs[0] == SpeakerArr::kMono || inputs[0] == SpeakerArr::kStereo)) {
            return SingleComponentEffect::setBusArrangements(inputs, numIns, outputs, numOuts);
        }
        return kResultFalse;
    }

    tresult PLUGIN_API canProcessSampleSize(int32 symbolicSampleSize) SMTG_OVERRIDE {
        return symbolicSampleSize == kSample32 ? kResultTrue : kResultFalse;
    }

    tresult PLUGIN_API setupProcessing(ProcessSetup& newSetup) SMTG_OVERRIDE {
        core_.prepareToPlay(newSetup.sampleRate, newSetup.maxSamplesPerBlock);
        return SingleComponentEffect::setupProcessing(newSetup);
    }

    tresult PLUGIN_API setParamNormalized(ParamID tag, ParamValue value) SMTG_OVERRIDE {
        const tresult res = SingleComponentEffect::setParamNormalized(tag, value);
        if (res == kResultOk) {
            if (tag == kParamGainId) {
                core_.setGainDb(normalizedToGainDb(value));
            } else if (tag == kParamBypassId) {
                core_.setBypass(value >= 0.5);
            }
        }
        return res;
    }

    tresult PLUGIN_API process(ProcessData& data) SMTG_OVERRIDE {
        if (data.inputParameterChanges != nullptr) {
            const int32 numParamsChanged = data.inputParameterChanges->getParameterCount();
            for (int32 i = 0; i < numParamsChanged; ++i) {
                if (IParamValueQueue* queue = data.inputParameterChanges->getParameterData(i)) {
                    const int32 numPoints = queue->getPointCount();
                    ParamValue value = 0.0;
                    int32 sampleOffset = 0;
                    if (numPoints > 0 &&
                        queue->getPoint(numPoints - 1, sampleOffset, value) == kResultTrue) {
                        if (queue->getParameterId() == kParamGainId) {
                            core_.setGainDb(normalizedToGainDb(value));
                        } else if (queue->getParameterId() == kParamBypassId) {
                            core_.setBypass(value >= 0.5);
                        }
                    }
                }
            }
        }

        if (data.numInputs == 0 || data.numOutputs == 0 || data.numSamples <= 0) {
            return kResultOk;
        }
        if (data.inputs == nullptr || data.outputs == nullptr) {
            return kResultOk;
        }

        auto& inBus = data.inputs[0];
        auto& outBus = data.outputs[0];
        const int32 channels = inBus.numChannels < outBus.numChannels ? inBus.numChannels : outBus.numChannels;
        if (channels <= 0 || inBus.channelBuffers32 == nullptr || outBus.channelBuffers32 == nullptr) {
            return kResultOk;
        }

        for (int32 ch = 0; ch < channels; ++ch) {
            float* inPtr = inBus.channelBuffers32[ch];
            float* outPtr = outBus.channelBuffers32[ch];
            if (inPtr == nullptr || outPtr == nullptr) {
                continue;
            }
            if (inPtr != outPtr) {
                std::memcpy(outPtr, inPtr, static_cast<std::size_t>(data.numSamples) * sizeof(float));
            }
        }

        core_.processBlock(outBus.channelBuffers32, channels, data.numSamples);
        outBus.silenceFlags = 0;
        return kResultOk;
    }

    tresult PLUGIN_API setState(IBStream* state) SMTG_OVERRIDE {
        if (state == nullptr) {
            return kInvalidArgument;
        }
        aetherforge::vst3::AetherForgeRealtimeCore::SerializedState pod{};
        int32 numBytesRead = 0;
        if (state->read(&pod, static_cast<int32>(sizeof(pod)), &numBytesRead) != kResultOk ||
            numBytesRead != static_cast<int32>(sizeof(pod))) {
            return kResultFalse;
        }
        if (!core_.setStateInformation(pod)) {
            return kResultFalse;
        }
        SingleComponentEffect::setParamNormalized(kParamGainId, gainDbToNormalized(core_.getGainDb()));
        SingleComponentEffect::setParamNormalized(kParamBypassId, core_.getBypass() ? 1.0 : 0.0);
        return kResultOk;
    }

    tresult PLUGIN_API getState(IBStream* state) SMTG_OVERRIDE {
        if (state == nullptr) {
            return kInvalidArgument;
        }
        aetherforge::vst3::AetherForgeRealtimeCore::SerializedState pod{};
        core_.getStateInformation(pod);
        int32 numBytesWritten = 0;
        if (state->write(&pod, static_cast<int32>(sizeof(pod)), &numBytesWritten) != kResultOk ||
            numBytesWritten != static_cast<int32>(sizeof(pod))) {
            return kResultFalse;
        }
        return kResultOk;
    }

private:
    aetherforge::vst3::AetherForgeRealtimeCore core_{};
};

} // namespace Steinberg::Vst

BEGIN_FACTORY_DEF(
    "AetherForge",
    "https://aetherforge.internal",
    "mailto:engineering@aetherforge.internal")

    DEF_CLASS2(
        INLINE_UID(0x41454647, 0x56535433, 0x434F5245, 0x00000001),
        PClassInfo::kManyInstances,
        kVstAudioEffectClass,
        "Aether Forge Processor",
        0,
        "Fx|Dynamics",
        "1.0.0",
        kVstVersionString,
        Steinberg::Vst::AetherForgeVst3Effect::createInstance)

END_FACTORY
