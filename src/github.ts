import { GraphQLClient, gql } from "graphql-request";
import { PullRequest } from "./entity";
import { parseISO } from "date-fns";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const graphQLClient = new GraphQLClient(GITHUB_GRAPHQL_ENDPOINT, {
  headers: {
    authorization: `Bearer ${GITHUB_TOKEN}`,
  },
});

export async function fetchAllMergedPullRequests(
  searchQuery: string,
  startDateString?: string,
  endDateString?: string
): Promise<PullRequest[]> {
  const startDate = startDateString ? parseISO(startDateString).toISOString() : "";
  const endDate = endDateString ? parseISO(endDateString).toISOString() : "";

  let q = `is:pr is:merged ${searchQuery}`;
  if (startDate !== "" || endDate !== "") {
    q += ` merged:${startDate}..${endDate}`;
  }

  return fetchAllPullRequestsByQuery(q);
}

interface PullRequestNode {
  title: string;
  author: {
    login: string;
  };
  url: string;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  commits: {
    nodes: {
      commit: {
        authoredDate: string;
      };
    }[];
  };
}

async function fetchAllPullRequestsByQuery(searchQuery: string): Promise<PullRequest[]> {
  const query = gql`
    query($after: String) {
      search(type: ISSUE, first: 100, query: "${searchQuery}", after: $after) {
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
            # for time to merge
            commits(first:1) {
              nodes {
                commit {
                  authoredDate
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
    }
  `;

  let after: string | undefined;
  let prs: PullRequest[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await graphQLClient.request(query, { after });
    prs = prs.concat(
      data.search.nodes.map(
        (p: PullRequestNode) =>
          new PullRequest(
            p.title,
            p.author.login,
            p.url,
            p.createdAt,
            p.mergedAt,
            p.additions,
            p.deletions,
            p.commits.nodes[0].commit.authoredDate
          )
      )
    );

    if (!data.search.pageInfo.hasNextPage) break;

    console.error(JSON.stringify(data, undefined, 2));

    after = data.search.pageInfo.endCursor;
  }

  return prs;
}
