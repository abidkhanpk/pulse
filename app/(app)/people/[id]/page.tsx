import { notFound } from "next/navigation";
import { getPerson } from "../actions";
import { PersonClient } from "@/components/people/person-client";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  return (
    <PersonClient
      person={{
        ...person,
        joinDate: person.joinDate ? person.joinDate.toISOString() : null,
      }}
    />
  );
}
