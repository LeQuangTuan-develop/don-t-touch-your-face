import { useEffect, useRef, useState} from 'react';
import { initNotifications, notify } from '@mycv/f8-notification';
import { Howl } from 'howler';
import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'
import * as knnClassifier from '@tensorflow-models/knn-classifier'
import soundUrl from './assets/hey_sondn.mp3'
import './App.css';

var sound = new Howl({
  src: [soundUrl]
});

const NOT_TOUCH_LABEL = 'not_touch'
const TOUCHED_LABEL = 'touched'
const TRAINING_TIMES = 50
const TOUCHED_CONFIDENCE = 0.8

function App() {
  const video = useRef()
  const canPlaySound = useRef(true)
  const classifier = useRef()
  const mobilenetModule = useRef()
  const [touched, setTouched] = useState(false)
  const [train1, setTrain1] = useState(false)
  const [train2, setTrain2] = useState(false)
  const [runAI, setRunAI] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const init = async () => {
    console.log("init")
    await setupCamera()

    console.log("setup successfully");

    classifier.current = knnClassifier.create();
    mobilenetModule.current = await mobilenet.load();

    console.log("setup done");
    console.log("khong tram tay len mat và bấm train 1");
    initNotifications({ cooldown: 3000 });
    setTrain1(true)
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia || 
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream
            video.current.addEventListener('loadeddata', resolve)
          }, 
          error => reject(error)
        )
      } else {
        reject()
      }
    })
  }

  const train = async label => {
    setIsLoading(true)
    console.log(`${label} đang train cho máy mặt của bạn`);
    for (let i = 0; i < TRAINING_TIMES; i++) {
      console.log(`process ${parseInt((i + 1)/TRAINING_TIMES * 100)}%`);
      await training(label)
    }
    if(train1) {
      setTrain2(true)
      setTrain1(false)
    }
    if (train2) {
      setTrain2(false)
      setRunAI(true)
    }
    setIsLoading(false)
  }

  /*
  * bước 1: Train cho máy khuôn mặt không chạm tay
  * bước 2: Train cho máy khuôn mặt có chạm tay
  * bước 3: lấy hình ảnh hiện tại, phân tích và so sánh với data đã học trước đó
  * ==> nếu mà matching với data khuôn mặt bị chạm tay ==> cảnh báo
  * 
  * */ 

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenetModule.current.infer(
        video.current,
        true
      )
      classifier.current.addExample(embedding, label)

      await sleep(100)
      resolve()
    })
  }

  const run = async () => {
    if (runAI) {
      setRunAI(false)
    }
    const embedding = mobilenetModule.current.infer(
      video.current,
      true
    )
    const result = await classifier.current.predictClass(embedding)

    if (result.label === TOUCHED_LABEL && result.confidences[result.label] > TOUCHED_CONFIDENCE) {
      console.log('touched');
      if (canPlaySound.current) {
        canPlaySound.current = false
        sound.play();
      }
      setTouched(true)
      notify('Bỏ tay ra', { body: 'Bạn vừa chạm tay vào mặt.' });
    } else {
      console.log('not touched');
      setTouched(false)
    }

    await sleep(200)

    run()
  }

  useEffect(() => {
    init()

    sound.on('end', function(){
      canPlaySound.current = true
    });
    
    // clean up 
    return () => {

    }
  }, [])

  return (
    <div className={`main ${touched ? 'touched' : ''}`}>
      <video 
        ref={video}
        className="video"
        autoPlay
      />

      <div className="controls">
        {train1 && 
        ( 
          <div className="control">
            <p className="tutor">Để khuôn mặt tự nhiên không chạm tay lên mặt và bấm train 1</p>
            <button className="btn btn-grad" onClick={() => train(NOT_TOUCH_LABEL)}>{isLoading ? 'Trainning ...' : 'Train 1' }</button>
          </div>
        )
        }
        {train2 && 
        (
          <div className="control">
            <p className="tutor">Bấm train2 và để tay di chuyển lên mặt </p>
            <button className="btn btn-grad" onClick={() => train(TOUCHED_LABEL)}>{isLoading ? 'Trainning ...' : 'Train 2' }</button>
          </div>
        ) 
        }
        {runAI && 
        (
          <div className="control">
            <p className="tutor">Bấm Run và xem kết quả khi bạn đưa tay lên mặt</p>
            <button className="btn btn-grad" onClick={() => run()}>Run</button>
          </div>
        )
        }
      </div>
    </div>
  );
}

export default App;
