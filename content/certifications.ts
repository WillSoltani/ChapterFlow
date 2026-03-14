export type Certification = {
  name: string;
  issuer: string;
  year?: string;
  verifyUrl?: string;
};

export const certifications: Certification[] = [
  {
    name: "AWS Certified Solutions Architect – Associate",
    issuer: "Amazon Web Services",
    year: "2025",
    verifyUrl:
      "https://www.credly.com/badges/c813d91b-bd80-495d-8ccf-a8268af05f8b/public_url",
  },
  {
    name: "AWS Certified Developer – Associate",
    issuer: "Amazon Web Services",
    year: "2025",
    verifyUrl:
      "https://www.credly.com/badges/72cedd8b-f92b-4dfb-ad19-da8ed5197641/public_url",
  },
  {
    name: "AWS Certified Cloud Practitioner",
    issuer: "Amazon Web Services",
    year: "2024",
    verifyUrl:
      "https://www.credly.com/badges/e9667c91-543f-463d-9ed5-39fedca92cdf/public_url",
  },
  {
    name: "Google Data Analytics Professional Certificate",
    issuer: "Coursera",
    verifyUrl:
      "https://coursera.org/share/a5e1d0e00602929475bbe63c9883c3c9",
  },
];
