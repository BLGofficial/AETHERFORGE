#include "public.sdk/source/vst/vstsinglecomponenteffect.h"
#include "public.sdk/source/main/pluginfactory.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/base/ustring.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "AetherPunchCore.h"

#include <cstdio>
#include <cstring>

namespace Steinberg::Vst {

namespace {
constexpr ParamID kParamAttackId = 0;
constexpr ParamID kParamSustainId = 1;
constexpr ParamID kParamDriveId = 2;
constexpr ParamID kParamCeilingId = 3;
constexpr ParamID kParamMixId = 4;
constexpr ParamID kParamBypassId = 5;

constexpr float normToRange(ParamValue norm, float minV, float maxV) noexcept {
    const double c = norm < 0.0 ? 0.0 : (norm > 1.0 ? 1.0 : norm);
    return minV + static_cast<float>(c) * (maxV - minV);
}

constexpr ParamValue rangeToNorm(float val, float minV, float maxV) noexcept {
    const float c = val < minV ? minV : (val > maxV ? maxV : val);
    return static_cast<ParamValue>((c - minV) / (maxV - minV));
}
} // namespace

class LinearRangeParam final : public Parameter {
public:
    LinearRangeParam(
        ParamID id,
        const char* titleAscii,
        const char* unitsAscii,
        float minPlain,
        float maxPlain,
        float defaultPlain)
        : minPlain_(minPlain), maxPlain_(maxPlain) {
        Steinberg::UString(info.title, USTRINGSIZE(info.title)).fromAscii(titleAscii);
        Steinberg::UString(info.shortTitle, USTRINGSIZE(info.shortTitle)).fromAscii(titleAscii);
        Steinberg::UString(info.units, USTRINGSIZE(info.units)).fromAscii(unitsAscii);
        info.id = id;
        info.stepCount = 0;
        info.defaultNormalizedValue = rangeToNorm(defaultPlain, minPlain, maxPlain);
        info.unitId = kRootUnitId;
        info.flags = ParameterInfo::kCanAutomate;
        setNormalized(info.defaultNormalizedValue);
    }

    void toString(ParamValue normValue, String128 string) const SMTG_OVERRIDE {
        char buf[32]{};
        std::snprintf(buf, sizeof(buf), "%.2f", static_cast<double>(normToRange(normValue, minPlain_, maxPlain_)));
        Steinberg::UString(string, 128).fromAscii(buf);
    }

    bool fromString(const TChar* string, ParamValue& normValue) const SMTG_OVERRIDE {
        Steinberg::UString wrapper(const_cast<TChar*>(string), -1);
        double parsed = 0.0;
        if (wrapper.scanFloat(parsed)) {
            normValue = rangeToNorm(static_cast<float>(parsed), minPlain_, maxPlain_);
            return true;
        }
        return false;
    }

private:
    float minPlain_;
    float maxPlain_;
};

class AetherPunchVst3Effect final : public SingleComponentEffect {
public:
    AetherPunchVst3Effect() = default;

    static FUnknown* createInstance(void* /*context*/) {
        return static_cast<IAudioProcessor*>(new AetherPunchVst3Effect());
    }

    tresult PLUGIN_API initialize(FUnknown* context) SMTG_OVERRIDE {
        const tresult res = SingleComponentEffect::initialize(context);
        if (res != kResultOk) {
            return res;
        }

        addAudioInput(STR16("Stereo In"), SpeakerArr::kStereo);
        addAudioOutput(STR16("Stereo Out"), SpeakerArr::kStereo);

        parameters.addParameter(new LinearRangeParam(kParamAttackId, "Attack", "dB", -18.0f, 18.0f, 0.0f));
        parameters.addParameter(new LinearRangeParam(kParamSustainId, "Sustain", "dB", -18.0f, 18.0f, 0.0f));
        parameters.addParameter(new LinearRangeParam(kParamDriveId, "Drive", "%", 0.0f, 100.0f, 15.0f));
        parameters.addParameter(new LinearRangeParam(kParamCeilingId, "Ceiling", "dBTP", -12.0f, -0.1f, -0.3f));
        parameters.addParameter(new LinearRangeParam(kParamMixId, "Mix", "%", 0.0f, 100.0f, 100.0f));
        parameters.addParameter(
            USTRING("Bypass"),
            nullptr,
            1,
            0.0,
            ParameterInfo::kCanAutomate | ParameterInfo::kIsBypass,
            kParamBypassId);

        core_.setAttackDb(0.0f);
        core_.setSustainDb(0.0f);
        core_.setDrivePct(15.0f);
        core_.setCeilingDb(-0.3f);
        core_.setMixPct(100.0f);
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
            applyNormalizedParameter(tag, value);
        }
        return res;
    }

    tresult PLUGIN_API process(ProcessData& data) SMTG_OVERRIDE {
        if (data.inputParameterChanges != nullptr) {
            const int32 numChanged = data.inputParameterChanges->getParameterCount();
            for (int32 i = 0; i < numChanged; ++i) {
                if (IParamValueQueue* queue = data.inputParameterChanges->getParameterData(i)) {
                    const int32 numPoints = queue->getPointCount();
                    ParamValue val = 0.0;
                    int32 offset = 0;
                    if (numPoints > 0 && queue->getPoint(numPoints - 1, offset, val) == kResultTrue) {
                        applyNormalizedParameter(queue->getParameterId(), val);
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
            if (inPtr == nullptr || outPtr == nullptr) continue;
            if (inPtr != outPtr) {
                std::memcpy(outPtr, inPtr, static_cast<std::size_t>(data.numSamples) * sizeof(float));
            }
        }

        core_.processBlock(outBus.channelBuffers32, channels, data.numSamples);
        outBus.silenceFlags = 0;
        return kResultOk;
    }

    tresult PLUGIN_API setState(IBStream* state) SMTG_OVERRIDE {
        if (state == nullptr) return kInvalidArgument;
        aetherforge::aetherpunch::AetherPunchCore::SerializedState pod{};
        int32 bytesRead = 0;
        if (state->read(&pod, static_cast<int32>(sizeof(pod)), &bytesRead) != kResultOk ||
            bytesRead != static_cast<int32>(sizeof(pod))) {
            return kResultFalse;
        }
        if (!core_.setStateInformation(pod)) {
            return kResultFalse;
        }
        SingleComponentEffect::setParamNormalized(kParamAttackId, rangeToNorm(core_.getAttackDb(), -18.0f, 18.0f));
        SingleComponentEffect::setParamNormalized(kParamSustainId, rangeToNorm(core_.getSustainDb(), -18.0f, 18.0f));
        SingleComponentEffect::setParamNormalized(kParamDriveId, rangeToNorm(core_.getDrivePct(), 0.0f, 100.0f));
        SingleComponentEffect::setParamNormalized(kParamCeilingId, rangeToNorm(core_.getCeilingDb(), -12.0f, -0.1f));
        SingleComponentEffect::setParamNormalized(kParamMixId, rangeToNorm(core_.getMixPct(), 0.0f, 100.0f));
        SingleComponentEffect::setParamNormalized(kParamBypassId, core_.getBypass() ? 1.0 : 0.0);
        return kResultOk;
    }

    tresult PLUGIN_API getState(IBStream* state) SMTG_OVERRIDE {
        if (state == nullptr) return kInvalidArgument;
        aetherforge::aetherpunch::AetherPunchCore::SerializedState pod{};
        core_.getStateInformation(pod);
        int32 bytesWritten = 0;
        if (state->write(&pod, static_cast<int32>(sizeof(pod)), &bytesWritten) != kResultOk ||
            bytesWritten != static_cast<int32>(sizeof(pod))) {
            return kResultFalse;
        }
        return kResultOk;
    }

private:
    void applyNormalizedParameter(ParamID tag, ParamValue value) noexcept {
        switch (tag) {
            case kParamAttackId:
                core_.setAttackDb(normToRange(value, -18.0f, 18.0f));
                break;
            case kParamSustainId:
                core_.setSustainDb(normToRange(value, -18.0f, 18.0f));
                break;
            case kParamDriveId:
                core_.setDrivePct(normToRange(value, 0.0f, 100.0f));
                break;
            case kParamCeilingId:
                core_.setCeilingDb(normToRange(value, -12.0f, -0.1f));
                break;
            case kParamMixId:
                core_.setMixPct(normToRange(value, 0.0f, 100.0f));
                break;
            case kParamBypassId:
                core_.setBypass(value >= 0.5);
                break;
            default:
                break;
        }
    }

    aetherforge::aetherpunch::AetherPunchCore core_{};
};

} // namespace Steinberg::Vst

BEGIN_FACTORY_DEF(
    "AetherForge",
    "https://aetherforge.internal",
    "mailto:engineering@aetherforge.internal")

    DEF_CLASS2(
        INLINE_UID(0x41455055, 0x4E434831, 0x56535433, 0x00000100),
        PClassInfo::kManyInstances,
        kVstAudioEffectClass,
        "Aether Punch",
        0,
        "Fx|Dynamics",
        "1.0.0",
        kVstVersionString,
        Steinberg::Vst::AetherPunchVst3Effect::createInstance)

END_FACTORY
