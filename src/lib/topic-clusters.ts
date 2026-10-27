import primary from '../../data/primary-topic-categories.json' with { type: 'json' };
import secondary from '../../data/topic-clusters.json' with { type: 'json' };
type Topic = { slug: string; cluster: string; browseCluster?: string; sourceCluster?: string };
// Keep the original planning CSV intact while allowing a more useful public category.
export function primaryClusterForTopic(topic: Topic): string {
  return primary[topic.slug as keyof typeof primary] ?? topic.browseCluster ?? topic.cluster;
}
export function clustersForTopic(topic: Topic): string[] {
  return [
    ...new Set([
      primaryClusterForTopic(topic),
      topic.sourceCluster ?? topic.cluster,
      ...(secondary[topic.slug as keyof typeof secondary] ?? []),
    ]),
  ];
}
export function topicInCluster(topic: Topic, cluster: string): boolean {
  return primaryClusterForTopic(topic) === cluster;
}
