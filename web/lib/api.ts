export const fetcher = (url: string) =>
  fetch(`http://localhost:4000${url}`).then((res) => res.json());
