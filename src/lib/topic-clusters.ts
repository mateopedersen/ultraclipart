import secondary from '../../data/topic-clusters.json';
type Topic = { slug: string; cluster: string };
export function clustersForTopic(topic: Topic): string[] {
  return [...new Set([topic.cluster, ...(secondary[topic.slug as keyof typeof secondary] ?? [])])];
}
export function topicInCluster(topic: Topic, cluster: string): boolean {
  return clustersForTopic(topic).includes(cluster);
}
