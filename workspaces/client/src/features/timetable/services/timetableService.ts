import { createFetch, createSchema } from '@better-fetch/fetch';
import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';

// import { schedulePlugin } from '@wsh-2025/client/src/features/requests/schedulePlugin';

const $fetch = createFetch({
  baseURL: process.env['API_BASE_URL'] ?? '/api',
  // plugins: [schedulePlugin],
  schema: createSchema({
    '/timetable': {
      output: schema.getTimetableResponse,
      query: schema.getTimetableRequestQuery,
    },
    '/timetable/:programId': {
      output: schema.getTimetableByIdResponse,
      params: schema.getTimetableByIdRequestParams,
      query: schema.getTimetableByIdRequestQuery,
    },
  }),
  throw: true,
});

interface TimetableService {
  fetchTimetableById: (params: {
    since: string;
    until: string;
    programId: string;
  }) => Promise<StandardSchemaV1.InferOutput<typeof schema.getTimetableByIdResponse>>;
  fetchTimetable: (
    params: StandardSchemaV1.InferOutput<typeof schema.getTimetableRequestQuery>,
  ) => Promise<StandardSchemaV1.InferOutput<typeof schema.getTimetableResponse>>;
}

export const timetableService: TimetableService = {
  async fetchTimetableById({ since, until, programId }) {
    const data = await $fetch('/timetable/:programId', { 
      params: {programId}, 
      query: { since, until} 
    });
    return data;
  },
  async fetchTimetable({ since, until }) {
    const data = await $fetch('/timetable', {
      query: { since, until },
    });
    return data;
  },
};
