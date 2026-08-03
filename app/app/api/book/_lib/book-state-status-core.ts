export type BookStateStatus = "started" | "not_started";

export function resolveBookStateStatus(params: {
  hasBookState: boolean;
  hasProgress: boolean;
}): BookStateStatus {
  return params.hasBookState || params.hasProgress ? "started" : "not_started";
}

export function buildBookStateGetResponse<State, ApplicationStates>(params: {
  state: State;
  applicationStates: ApplicationStates;
  hasBookState: boolean;
  hasProgress: boolean;
}): {
  stateStatus: BookStateStatus;
  state: State;
  applicationStates: ApplicationStates;
} {
  return {
    stateStatus: resolveBookStateStatus(params),
    state: params.state,
    applicationStates: params.applicationStates,
  };
}
