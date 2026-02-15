import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { ArrayValues } from 'type-fest';

import { formatDateTimeJST } from '@wsh-2025/client/src/utils/datetime';
import { Hoverable } from '@wsh-2025/client/src/features/layout/components/Hoverable';
import { ProgramDetailDialog } from '@wsh-2025/client/src/pages/timetable/components/ProgramDetailDialog';
import { resizedImageUrl } from '@wsh-2025/client/src/utils/image';
import { useColumnWidth } from '@wsh-2025/client/src/pages/timetable/hooks/useColumnWidth';
import { useCurrentUnixtimeMs } from '@wsh-2025/client/src/pages/timetable/hooks/useCurrentUnixtimeMs';
import { useProgramById } from '@wsh-2025/client/src/features/program/hooks/useProgramById';
import { useSelectedProgramId } from '@wsh-2025/client/src/pages/timetable/hooks/useSelectedProgramId';
import { useStore } from '@wsh-2025/client/src/app/StoreContext';
import { observeResize, unobserveResize } from '@wsh-2025/client/src/utils/sharedResizeObserver';
import { observe, unobserve } from '@wsh-2025/client/src/utils/sharedIntersectionObserver';

interface Props {
  height: number;
  program: ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getTimetableResponse>>;
}

export const Program = ({ height, program }: Props): ReactElement => {
  const width = useColumnWidth(program.channelId);

  const [selectedProgramId, setProgram] = useSelectedProgramId();
  const shouldProgramDetailDialogOpen = program.id === selectedProgramId;
  const state = useStore((s) => s);
  // fetchProgramById の結果はストアに入るので、useProgramById で取得
  const fullProgram = useProgramById({ programId: program.id });
  const onClick = async () => {
    await state.features.program.fetchProgramById({ programId: program.id });
    setProgram(program);
  };

  const currentUnixtimeMs = useCurrentUnixtimeMs();
  const startMs = new Date(program.startAt).getTime();
  const endMs = new Date(program.endAt).getTime();
  const isBroadcasting = startMs <= currentUnixtimeMs && currentUnixtimeMs < endMs;
  const isArchived = endMs <= currentUnixtimeMs;

  const titleRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);

  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    observe(el, (entry) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        unobserve(el);
      }
    });

    return () => {
      unobserve(el);
    };
  }, []);

  const [shouldImageBeVisible, setShouldImageBeVisible] = useState<boolean>(false);
  useEffect(() => {
    const titleEl = titleRef.current;
    const imageEl = imageRef.current;
    if (!titleEl && !imageEl) return;

    const check = () => {
      const imageHeight = imageEl?.clientHeight ?? 0;
      const titleHeight = titleEl?.clientHeight ?? 0;
      setShouldImageBeVisible(imageHeight <= height - titleHeight);
    };

    if (titleEl) observeResize(titleEl, check);
    if (imageEl) observeResize(imageEl, check);

    check();

    return () => {
      if (titleEl) unobserveResize(titleEl);
      if (imageEl) unobserveResize(imageEl);
    };
  }, [height]);

  return (
    <>
      <Hoverable classNames={{ hovered: isArchived ? 'brightness-200' : 'brightness-125' }}>
        <button
          ref={containerRef}
          className={`w-auto border-[1px] border-solid border-[#000000] bg-[${isBroadcasting ? '#FCF6E5' : '#212121'}] px-[12px] py-[8px] text-left opacity-${isArchived ? 50 : 100}`}
          style={{ width, height: `${height}px` }}
          type="button"
          onClick={onClick}
        >
          <div className="flex size-full flex-col overflow-hidden">
            <div ref={titleRef} className="mb-[8px] flex flex-row items-start justify-start">
              <span
                className={`mr-[8px] shrink-0 grow-0 text-[14px] font-bold text-[${isBroadcasting ? '#767676' : '#999999'}]`}
              >
                {formatDateTimeJST(program.startAt, 'mm')}
              </span>
              <div
                className={`grow-1 shrink-1 overflow-hidden text-[14px] font-bold text-[${isBroadcasting ? '#212121' : '#ffffff'}]`}
              >
                <span className="line-clamp-3">{program.title}</span>
              </div>
            </div>
            <div className={`opacity-${shouldImageBeVisible ? 100 : 0} w-full`}>
              <img
                ref={imageRef}
                alt=""
                className="pointer-events-none w-full rounded-[8px] border-[2px] border-solid border-[#FFFFFF1F]"
                src={isInView ? `${program.thumbnailUrl}` : undefined}
                srcSet={`
                  ${resizedImageUrl(program.thumbnailUrl, 320)} 320w
                `}
              />
            </div>
          </div>
        </button>
      </Hoverable>
      {shouldProgramDetailDialogOpen && fullProgram && (
        <ProgramDetailDialog isOpen={shouldProgramDetailDialogOpen} program={fullProgram} />
      )}
    </>
  );
};
