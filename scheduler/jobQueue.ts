import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "JOB_QUEUE";

export type Job = {
  id: string;
  fileName: string;
  tasks: string[]; 
  currentTask: number;
  status: "pending" | "processing" | "done";
};

export async function getJobs(): Promise<Job[]> {
  const data = await AsyncStorage.getItem(KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveJobs(jobs: Job[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(jobs));
}

export async function addJob(job: Job) {
  const jobs = await getJobs();
  jobs.push(job);
  await saveJobs(jobs);
}

export async function getNextJob(): Promise<Job | null> {
  const jobs = await getJobs();
  return jobs.find(j => j.status === "pending") || null;
}

export async function updateJob(updated: Job) {
  const jobs = await getJobs();
  const newJobs = jobs.map(j => (j.id === updated.id ? updated : j));
  await saveJobs(newJobs);
}