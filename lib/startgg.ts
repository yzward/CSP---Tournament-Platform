const STARTGG_API_URL = 'https://api.start.gg/gql/alpha';

export async function fetchStartGG(query: string, variables: any = {}) {
  const token = process.env.STARTGG_API_KEY;
  
  if (!token) {
    throw new Error('STARTGG_API_KEY environment variable is missing');
  }

  const response = await fetch(STARTGG_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const json = await response.json();

  if (json.errors) {
    console.error('Start.gg API Error:', json.errors);
    throw new Error(json.errors[0].message || 'Error fetching from Start.gg');
  }

  return json.data;
}

// Example queries we will need:

export const GET_TOURNAMENT_QUERY = `
  query TournamentQuery($slug: String!) {
    tournament(slug: $slug) {
      id
      name
      slug
      url
      city
      startAt
      endAt
      isOnline
      events {
        id
        name
        numEntrants
        type
        videogame {
          id
        }
        phases {
          id
          name
          phaseGroups {
            nodes {
              id
              displayIdentifier
            }
          }
        }
      }
    }
  }
`;

export const GET_EVENT_ENTRANTS_QUERY = `
  query EventEntrants($eventId: ID!, $page: Int!) {
    event(id: $eventId) {
      entrants(query: {page: $page, perPage: 50}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          name
          participants {
            id
            gamerTag
            user {
              id
              discriminator
            }
          }
        }
      }
    }
  }
`;

export const GET_SETS_QUERY = `
  query PhaseGroupSets($phaseGroupId: ID!, $page: Int!) {
    phaseGroup(id: $phaseGroupId) {
      sets(page: $page, perPage: 50, sortType: STANDARD) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          fullRoundText
          round
          state
          slots {
            id
            entrant {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const REPORT_SET_MUTATION = `
  mutation ReportSet($setId: ID!, $winnerId: ID!, $score: String!) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, score: $score) {
      id
      state
    }
  }
`;

export const GET_USER_ORGANIZATIONS_QUERY = `
  query UserOrganizations {
    currentUser {
      id
      organizations {
        nodes {
          id
          name
        }
      }
    }
  }
`;
