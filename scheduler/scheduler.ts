import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNextJob, updateJob } from "./jobQueue";
import { generateJobsFromFolders } from "./autojobs";
import { TASKS } from "./taskRegistry";

const SCHEDULE_KEY = "SCHEDULE_TIME";

let running = false;
let lastRunMinute: string | null = null;
export async function setScheduleTime(time: string) {
  await AsyncStorage.setItem(SCHEDULE_KEY, time);
}

export async function getScheduleTime(): Promise<string | null> {
  return await AsyncStorage.getItem(SCHEDULE_KEY);
}

export async function shouldRunNow(): Promise<boolean> {
  const saved = await getScheduleTime();
  if (!saved) return false;

  const now = new Date();
  const current = `${now.getHours()}:${now.getMinutes()}`;

  if (current === lastRunMinute) return false;

  if (current === saved) {
    lastRunMinute = current;
    return true;
  }

  return false;
}

export async function runScheduler() {
  if (running) return;
  running = true;

  console.log("Scheduler started");

  try {
    // 🔥 NEW: generate jobs from selected folders
    await generateJobsFromFolders();

    let job = await getNextJob();

    while (job) {
      job.status = "processing";
      await updateJob(job);

      const taskName = job.tasks[job.currentTask];

      const task = TASKS[taskName];

      if (task) {
        await task(job.fileName);
      }

      job.currentTask++;

      if (job.currentTask >= job.tasks.length) {
        job.status = "done";
      } else {
        job.status = "pending";
      }

      await updateJob(job);

      job = await getNextJob();
    }

  } catch (err) {
    console.log("Scheduler error:", err);
  }

  running = false;
}