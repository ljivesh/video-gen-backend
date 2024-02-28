import bodyParser from "body-parser";
import express from "express";
import fs from "fs";
import axios from "axios";
import { decode } from "jsonwebtoken";

// import { bundle } from "@remotion/bundler";
// import { renderMedia, selectComposition } from "@remotion/renderer";
// import { dummyProps } from "./dummyProps.js";
import path from "path";
import cors from "cors";
// import {
//   AudioConfig,
//   ResultReason,
//   SpeechConfig,
//   SpeechSynthesizer,
// } from "microsoft-cognitiveservices-speech-sdk";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_BUCKET_REGION,
});

const app = express();

app.use(bodyParser.json());
app.use(cors());

const uploadFileToS3 = (file) => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, async (err, data) => {
      if (err) {
        reject(err);
      }

      if (!process.env.AWS_BUCKET_NAME) {
        reject(Error("Bucket name not specified."));
      }

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: file,
        Body: data,
      });

      try {
        const response = await s3Client.send(command);

        if (response["$metadata"].httpStatusCode === 200) {
          resolve({
            url:
              "https://video-rendering-service-bucket.s3.ap-south-1.amazonaws.com/" +
              file,
          });
        } else {
          throw Error("Upload to S3 Failed");
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  });
};

app.get("/get-speech-token", async (req, res) => {
  if (!process.env.SPEECH_KEY || !process.env.SPEECH_REGION) {
    res
      .status(400)
      .send("You forgot to add your speech key or region to the .env file.");
  } else {
    const headers = {
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.SPEECH_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    try {
      const tokenResponse = await axios.post(
        `https://${process.env.SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
        null,
        headers
      );
      const expirationTime = decode(tokenResponse.data).exp;
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiration = expirationTime - currentTime;

      console.log(timeUntilExpiration);
      res.send({ token: tokenResponse.data, region: process.env.SPEECH_REGION });
    } catch (err) {
      console.error(err);
      res.status(401).send("There was an error authorizing your speech key.");
    }
  }
});

// const ssmlTemplate = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
// <voice name="__VOICE__"  >
// <mstts:viseme type="FacialExpression"/>

// __TEXT__
// </voice>
// </speak>`;

// const synthesizeVoice = (script) => {
//   return new Promise((resolve, reject) => {
//     if (!process.env.SPEECH_KEY || !process.env.SPEECH_REGION) {
//       console.log("Please set your speech key and/or region");
//       reject(Error("Speech Key/Region Not set"));
//     }

//     const avatarBlendData = [];

//     const audioFile = "SynthesizedAudios/audio1.mp3";
//     const speechConfig = SpeechConfig.fromSubscription(
//       process.env.SPEECH_KEY,
//       process.env.SPEECH_REGION
//     );
//     const audioConfig = AudioConfig.fromAudioFileOutput(audioFile);

//     let synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);

//     synthesizer.visemeReceived = (s, e) => {
//       // console.log(e);

//       if (e.animation) {
//         JSON.parse(e.animation).BlendShapes.forEach((blendShape) =>
//           avatarBlendData.push(blendShape)
//         );
//       }
//     };

//     synthesizer.speakSsmlAsync(
//       script,
//       (result) => {
//         if (result.reason === ResultReason.SynthesizingAudioCompleted) {
//           console.log("Voice Synthsis Complete");
//           resolve({ audioFile, avatarBlendData });
//           synthesizer.close();
//           synthesizer = null;
//         } else {
//           console.log(
//             "An error occured while synthesizing of the voice: ",
//             result.errorDetails
//           );
//           reject(result.errorDetails);
//           synthesizer.close();
//           synthesizer = null;
//         }
//       },
//       (err) => {
//         console.trace("err -" + err);
//         reject(err);
//         synthesizer.close();
//         synthesizer = null;
//       }
//     );
//   });
// };

// const bundleProject = async () => {
//   const bundleLocation = await bundle({
//     entryPoint: path.resolve(
//       "/home/menma/projects/remotion/my-video/src/index.ts"
//     ),
//     // If you have a Webpack override, make sure to add it here
//     webpackOverride: (config) => config,
//   });

//   return bundleLocation;
// };

// app.get("/synthesize-voice", async (req, res) => {
//   const line =
//     "संस्कृति और धार्मिकता का परिचय: संस्कृत श्लोक बच्चों को भारतीय संस्कृति और धार्मिकता के मूल सिद्धांतों का परिचय कराते हैं। संस्कृत श्लोक अर्थ सहित समझाने से ये श्लोक बच्चों को अपने धार्मिक और सांस्कृतिक मूल्यों के प्रति समर्पित करते हैं।";

//   const script = ssmlTemplate
//     .replace("__TEXT__", line)
//     .replace("__VOICE__", "hi-IN-MadhurNeural");

//   try {
//     const voiceData = await synthesizeVoice(script);

//     res.json(voiceData);
//   } catch (error) {
//     res.json({ message: "Failed", error });
//   }
// });

app.post("/get-video-data", async (req, res) => {
  const { id } = req.body;
  console.log(req.body);

  console.log("Id: ", id);

  const dummyVideoData = {
    model: {
      url: "https://models.readyplayer.me/6581a43656e8f9ee0ff87f05.glb?useMeshOptCompression=true&textureFormat=webp&morphTargets=ARKit",
      gender: "male",
      animations:
        "https://menma-s3.s3.ap-south-1.amazonaws.com/animations/menma-animations-5.glb",
    },
    script:
      `नमस्कार,मेरा नाम जिवेश है और मैं बहुत एक्सासिटेड हूं आपको दो हज़ार चौबीस  के सबसे स्लिममेस्ट फ़ोन , वीवो वी थिरटी  सीरीज़, के बारे में बताने के लिए -  डिज़ाइन और बेहतरीन कैमरा  का कमाल का कॉम्बिनेशन।वीवो वी थिरटी प्रो ज़ेइस्स प्रोफैशनल पोर्ट्रेट कैमरा  के साथ आता है और ज़ेइस्स स्टाइल  कैमरा दिखाता है। इसका मतलब है कि अब आप अपने साधारण फोटोज़ को प्रो फोटोज़ में बदल सकते हैं। और न केवल यह, स्टूडियो क्वालीटी औरा लाइट आपको कम लाइट  में भी प्रोफैशनल लेवल  के क्लिक्स देता है | तो आप किस बात की प्रतीक्षा कर रहे हैं?  नीचे दिए गए नंबर पर मुझ से संपर्क करे ताकि आपको एक्सक्लूसिव प्री-बुकिंग ऑफर्स के बारे में पता चल सके।`,
    voice: "hi-IN-MadhurNeural",
    name: "Madhur",
    number: "1234567890",
  };

  res.json(dummyVideoData);
});

// app.get('/upload-to-s3', async (req, res)=> {

//   try {
//     const data = await uploadAudioToS3('SynthesizedAudios/audio1.mp3');

//     res.json(data);

//   } catch(error) {
//     res.json(error);
//   }

// })

// app.get("/render-video", async (req, res) => {

//   const {voice, model, script} = req.body;

//   if(!voice || !model || !script) {
//     res.status(400).json({message: "Please send the correct data"});
//     return;
//   }

//   const ssml = ssmlTemplate
//   .replace("__TEXT__", script)
//   .replace("__VOICE__", voice);

//   try {
//     const voiceData = await synthesizeVoice(ssml);
//     const uploadData = await uploadFileToS3(voiceData.audioFile)
//     const props = {
//       model,
//       audioSrc: uploadData.url,
//       videoSrc: 'https://video-rendering-service-bucket.s3.ap-south-1.amazonaws.com/videos/vivoad.mp4',
//       avatarBlendData: voiceData.avatarBlendData
//     };

//     console.log(props.audioSrc);
//     const bundleLocation = await bundleProject();

//     console.log(bundleLocation);

//     let renderingTime = null;
//     const renderingProgress = ({ progress, renderedDoneIn }) => {
//       console.log(`Rendering is ${progress * 100}% complete`);
//       if (renderedDoneIn) {
//         console.log(`Rendered in ${renderedDoneIn}ms`);
//         renderingTime = renderedDoneIn;
//       }
//     };

//     const composition = await selectComposition({
//       serveUrl: bundleLocation,
//       id: "Scene",
//       inputProps: props,
//     });

//     await renderMedia({
//       composition,
//       serveUrl: bundleLocation,
//       codec: "h264",
//       outputLocation: `out/${"Scene"}.mp4`,
//       gl: "angle",
//       concurrency: null,
//       // logLevel: 'verbose',
//       onProgress: renderingProgress,
//       frameRange: [0, 100],
//     });

//     console.log("Render done!");

//     const videoData = await uploadFileToS3('out/Scene.mp4');

//     res.json({ message: "Rendering Doneee", renderingTime, url: videoData.url });

//   } catch(error) {
//     console.error(error);

//     res.status(500).json({message: "Rendering Failed..."});
//   }

// });

app.listen(process.env.PORT, () =>
  console.log(`App started at port: ${process.env.PORT}`)
);
