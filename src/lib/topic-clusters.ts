import secondary from '../../data/topic-clusters.json' with { type: 'json' };
type Topic = { slug: string; cluster: string; browseCluster?: string };
// Keep the original planning CSV intact while allowing a more useful public category.
export function primaryClusterForTopic(topic: Topic): string {
  return topic.browseCluster ?? topic.cluster;
}
export function clustersForTopic(topic: Topic): string[] {
  return [
    ...new Set([
      primaryClusterForTopic(topic),
      ...(secondary[topic.slug as keyof typeof secondary] ?? []),
    ]),
  ];
}
export function topicInCluster(topic: Topic, cluster: string): boolean {
  return clustersForTopic(topic).includes(cluster);
}
