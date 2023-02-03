import fs from "fs";
import { PullRequest } from "./entity";
import { median as _median } from "mathjs";
import { fetchAllPullRequests } from "./github";
import humanDuration from "humanize-duration";

interface StatCommandOptions {
  input: string | undefined;
  start: string | undefined;
  end: string | undefined;
  query: string | undefined;
}
export async function statCommand(options: StatCommandOptions): Promise<void> {
  let prs: PullRequest[] = [];

  if (options.query) {
    prs = await fetchAllPullRequests(options.query, options.start, options.end);
  } else if (options.input) {
    prs = createPullRequestsByLog(options.input);
  } else {
    console.error("You must specify either --query or --input");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(createStat(prs), undefined, 2));
}

interface PullRequestStat {
  count: string;
  additionsAverage: string;
  additionsMedian: string;
  deletionsAverage: string;
  deletionsMedian: string;
  leadTimeAverage: string;
  leadTimeMedian: string;
  timeToMergeAverage: string;
  timeToMergeMedian: string;
  timeToMergeFromFirstReviewAverage: string;
  timeToMergeFromFirstReviewMedian: string;
  responseTimeAverage: string;
  responseTimeMedian: string;
}
export function createStat(prs: PullRequest[]): PullRequestStat {
  const mergedPrs = prs.filter((pr) => pr.mergedAt != undefined);
  const leadTimes = mergedPrs.map((pr) => pr.leadTimeSeconds);
  const timeToMerges = mergedPrs.map((pr) => pr.timeToMergeSeconds);
  const timeToMergeFromFirstReviews = mergedPrs
    .map((pr) => pr.timeToMergeFromFirstReviewSeconds)
    .filter((x): x is number => x !== undefined);
  const responseTimes = prs.map((pr) => pr.responseTimeSeconds).filter((x): x is number => x !== undefined);

  return {
    count: prs.length + " pull requests",
    additionsAverage: Math.round(average(prs.map((pr) => pr.additions))) + " lines",
    additionsMedian: Math.round(median(prs.map((pr) => pr.additions))) + " lines",
    deletionsAverage: Math.round(average(prs.map((pr) => pr.deletions))) + " lines",
    deletionsMedian: Math.round(median(prs.map((pr) => pr.deletions))) + " lines",
    leadTimeAverage: humanDuration(Math.floor(average(leadTimes)) * 1000),
    leadTimeMedian: humanDuration(Math.floor(median(leadTimes)) * 1000),
    timeToMergeAverage: humanDuration(Math.floor(average(timeToMerges)) * 1000),
    timeToMergeMedian: humanDuration(Math.floor(median(timeToMerges)) * 1000),
    timeToMergeFromFirstReviewAverage: humanDuration(Math.floor(average(timeToMergeFromFirstReviews)) * 1000),
    timeToMergeFromFirstReviewMedian: humanDuration(Math.floor(median(timeToMergeFromFirstReviews)) * 1000),
    responseTimeAverage: humanDuration(Math.floor(average(responseTimes)) * 1000),
    responseTimeMedian: humanDuration(Math.floor(median(responseTimes)) * 1000),
  };
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((prev, current) => prev + current) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return _median(numbers);
}

export function createPullRequestsByLog(path: string): PullRequest[] {
  const logs = JSON.parse(fs.readFileSync(path, "utf8"));
  return logs.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) =>
      new PullRequest(
        p.title,
        p.author,
        p.url,
        p.createdAt,
        p.mergedAt,
        p.additions,
        p.deletions,
        p.authoredDate,
        p.firstReviewedAt
      )
  );
}
