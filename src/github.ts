import { parseISO } from "date-fns";
import { Octokit } from "@octokit/core";
import { paginateGraphql } from "@octokit/plugin-paginate-graphql";
import { PullRequest } from "./entity";

const GITHUB_ENDPOINT = process.env.GITHUB_ENDPOINT || "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const octokit = new (Octokit.plugin(paginateGraphql))({ auth: GITHUB_TOKEN, baseUrl: GITHUB_ENDPOINT });

export async function fetchAllPullRequests(
  searchQuery: string,
  startDateString?: string,
  endDateString?: string
): Promise<PullRequest[]> {
  const startDate = startDateString ? parseISO(startDateString).toISOString() : "";
  const endDate = endDateString ? parseISO(endDateString).toISOString() : "";

  let q = `is:pr ${searchQuery}`;
  if (startDate !== "" || endDate !== "") {
    q += ` created:${startDate}..${endDate}`;
  }

  return await fetchAllPullRequestsByQuery(q);
}

// export async function fetchAllIssues(
//   searchQuery: string,
//   startDateString?: string,
//   endDateString?: string
// ): Promise<PullRequest[]> {
//   const startDate = startDateString ? parseISO(startDateString).toISOString() : "";
//   const endDate = endDateString ? parseISO(endDateString).toISOString() : "";

//   let q = `is:issue ${searchQuery}`;
//   if (startDate !== "" || endDate !== "") {
//     q += ` created:${startDate}..${endDate}`;
//   }

//   return fetchAllIssuesByQuery(q);
// }

interface PullRequestNode {
  title: string;
  author: {
    login: string;
  } | null;
  url: string;
  createdAt: string;
  mergedAt?: string;
  additions: number;
  deletions: number;
  commits: {
    nodes: {
      commit: {
        authoredDate: string;
      };
    }[];
  };
  reviews: {
    nodes: {
      createdAt: string;
    }[];
  };
}

async function fetchAllPullRequestsByQuery(searchQuery: string): Promise<PullRequest[]> {
  const pageIterator = octokit.graphql.paginate.iterator(
    `query paginate($cursor: String, $searchQuery: String!) {
      search(type: ISSUE, first: 100, query: $searchQuery, after: $cursor) {
        issueCount
        nodes {
          ... on PullRequest {
            title
            author {
              login
            }
            url
            createdAt
            mergedAt
            additions
            deletions
            # for lead time
            commits(first:1) {
              nodes {
                commit {
                  authoredDate
                }
              }
            }
            # for time to merge from review
            reviews(first:1) {
              nodes {
                ... on PullRequestReview {
                  createdAt
                }
              }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }`,
    { searchQuery }
  );
  let prs: PullRequest[] = [];
  for await (const response of pageIterator) {
    prs = prs.concat(
      response.search.nodes.map((p: PullRequestNode) => {
        return new PullRequest(
          p.title,
          p.author ? p.author.login : undefined,
          p.url,
          p.createdAt,
          p.mergedAt,
          p.additions,
          p.deletions,
          p.commits.nodes[0].commit.authoredDate,
          p.reviews.nodes[0] ? p.reviews.nodes[0].createdAt : undefined
        );
      })
    );
  }
  return prs;
}
