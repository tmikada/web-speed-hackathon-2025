import { lens } from '@dhmk/zustand-lens';
import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { produce } from 'immer';
import { ArrayValues } from 'type-fest';

import { timetableService } from '@wsh-2025/client/src/features/timetable/services/timetableService';

type ProgramId = string;

interface TimetableState {
  programs: Record<ProgramId, ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getTimetableResponse>>>;
}

interface TimetableActions {
  fetchTimetableById: (params: {
    since: string;
    until: string;
    programId: ProgramId;
  }) => Promise<StandardSchemaV1.InferOutput<typeof schema.getTimetableByIdResponse>>;
  fetchTimetable: (params: {
    since: string;
    until: string;
  }) => Promise<StandardSchemaV1.InferOutput<typeof schema.getTimetableResponse>>;
}

export const createTimetableStoreSlice = () => {
  return lens<TimetableState & TimetableActions>((set) => ({
    fetchTimetableById: async ({ since, until, programId }) => {
      const programs = await timetableService.fetchTimetableById({ since, until, programId });
      set((state) => {
        return produce(state, (draft) => {
          for (const program of programs) {
            draft.programs[program.id] = program;
          }
        });
      });
      return programs;
    },
    fetchTimetable: async ({ since, until }) => {
      const programs = await timetableService.fetchTimetable({ since, until });
      set((state) => {
        return produce(state, (draft) => {
          draft.programs = {};
          for (const program of programs) {
            draft.programs[program.id] = program;
          }
        });
      });
      return programs;
    },
    programs: {},
  }));
};
