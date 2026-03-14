export type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
  fromLabel: string;
  sizeLabel: string;
  fingerprint: string;
};

export type StagedListItem = {
  id: string;
  name: string;
  sizeLabel: string;
  detectedType: string;
  extension: string;
};
