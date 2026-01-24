import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Users, Heart, MessageCircle, Eye, Bookmark, Upload, Calendar, Share2, Target, TrendingUp, Settings, MousePointer, Plus, Clock, RefreshCw, Sparkles } from "lucide-react";
import { useImportHistory } from "@/hooks/useImportHistory";
import { GoalsPanel } from "./GoalsPanel";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { usePerformanceGoals } from "@/hooks/usePerformanceGoals";
import { InstagramPostsTableAdvanced } from "./InstagramPostsTableAdvanced";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { AIInsightsCard } from "./AIInsightsCard";
import { StatCard } from "./StatCard";
import { GoalGauge } from "./GoalGauge";
import { MetricMiniCard } from "./MetricMiniCard";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";
import { GoalProgressCard } from "./GoalProgressCard";
import { PostAveragesSection } from "./PostAveragesSection";

import { TopContentTable } from "./TopContentTable";
import { TopPostsGrid } from "./TopPostsGrid";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { DataCompletenessWarning } from "./DataCompletenessWarning";
import { MetricsDataAlert } from "./MetricsDataAlert";
import { BestPostsByMetric } from "./BestPostsByMetric";
import { InstagramStoriesSection } from "./InstagramStoriesSection";
import { InstagramStoriesCSVUpload } from "./InstagramStoriesCSVUpload";
import { InstagramStoriesMetricsCards } from "./InstagramStoriesMetricsCards";
import { useInstagramStories } from "@/hooks/useInstagramStories";
import { format, subDays, isAfter, isBefore, parseISO, startOfDay, getDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstagramDashboardProps {
  clientId: string;
  posts: InstagramPost[];
  metrics: PerformanceMetrics[];
  isLoadingPosts?: boolean;
  isLoadingMetrics?: boolean;
}

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo período" },
  { value: "custom", label: "Personalizado" },
];

// All metrics use the primary theme color for unified visual
const metricOptions = [
  { key: "views", label: "Visualizações", dataKey: "views", color: "hsl(var(--primary))" },
  { key: "reach", label: "Contas alcançadas", dataKey: "reach", color: "hsl(var(--primary))" },
  { key: "interactions", label: "Interações", dataKey: "interactions", color: "hsl(var(--primary))" },
  { key: "linkClicks", label: "Clique no Link", dataKey: "linkClicks", color: "hsl(var(--primary))" },
  { key: "subscribers", label: "Novos Seguidores", dataKey: "subscribers", color: "hsl(var(--primary))" },
  { key: "profileVisits", label: "Visitas", dataKey: "profileVisits", color: "hsl(var(--primary))" },
];

import { useWorkspace } from "@/hooks/useWorkspace";

export function InstagramDashboard({ 
  clientId, 
  posts, 
  metrics, 
  isLoadingPosts, 
  isLoadingMetrics 
}: InstagramDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [selectedMetric, setSelectedMetric] = useState("views");
  const [showUploadPosts, setShowUploadPosts] = useState(false);
  const [topPostsMetric, setTopPostsMetric] = useState("engagement");
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  
  const { goals } = usePerformanceGoals(clientId);
  const { data: stories = [], isLoading: isLoadingStories, refetch: refetchStories } = useInstagramStories(clientId);
  const { imports: importHistory } = useImportHistory(clientId);
  const instagramGoal = goals.find(g => g.platform === 'instagram' && g.metric_name === 'followers');
  const { canImportData, canGenerateReports } = useWorkspace();

  // Get last import date for Instagram
  const lastInstagramImport = useMemo(() => {
    const instagramImports = importHistory.filter(i => i.platform === 'instagram');
    return instagramImports.length > 0 ? instagramImports[0] : null;
  }, [importHistory]);

  // Filter data by period
  const cutoffDate = useMemo(() => {
    if (period === "all") return null;
    if (period === "custom") {
      return customDateFrom ? startOfDay(customDateFrom) : null;
    }
    return startOfDay(subDays(new Date(), parseInt(period)));
  }, [period, customDateFrom]);

  const endDate = useMemo(() => {
    if (period === "custom" && customDateTo) {
      return startOfDay(customDateTo);
    }
    return null;
  }, [period, customDateTo]);

  // Previous period cutoff for comparison
  const previousPeriodCutoff = useMemo(() => {
    if (period === "all") return null;
    
    if (period === "custom") {
      // For custom period, calculate based on selected dates
      if (!customDateFrom || !customDateTo) return null;
      
      // Calculate duration of selected period in days
      const durationMs = customDateTo.getTime() - customDateFrom.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;
      
      // Previous period starts "durationDays" before customDateFrom
      return startOfDay(subDays(customDateFrom, durationDays));
    }
    
    const days = parseInt(period);
    return startOfDay(subDays(new Date(), days * 2));
  }, [period, customDateFrom, customDateTo]);

  // End of previous period (for custom periods)
  const previousPeriodEnd = useMemo(() => {
    if (period === "all") return null;
    
    if (period === "custom") {
      // Previous period ends 1 day before current period starts
      if (!customDateFrom) return null;
      return startOfDay(subDays(customDateFrom, 1));
    }
    
    // For numeric periods, previous period ends at cutoffDate
    return cutoffDate;
  }, [period, customDateFrom, cutoffDate]);

  const filteredPosts = useMemo(() => {
    if (period === "all") return posts;
    return posts.filter(post => {
      if (!post.posted_at) return false;
      const postDate = parseISO(post.posted_at);
      if (cutoffDate && isBefore(postDate, cutoffDate)) return false;
      if (endDate && isAfter(postDate, endDate)) return false;
      return true;
    });
  }, [posts, cutoffDate, endDate, period]);

  const filteredMetrics = useMemo(() => {
    if (period === "all") return metrics;
    return metrics.filter(m => {
      if (!m.metric_date) return false;
      const metricDate = parseISO(m.metric_date);
      if (cutoffDate && isBefore(metricDate, cutoffDate)) return false;
      if (endDate && isAfter(metricDate, endDate)) return false;
      return true;
    });
  }, [metrics, cutoffDate, endDate, period]);

  // Previous period metrics for comparison
  const previousPeriodMetrics = useMemo(() => {
    if (!previousPeriodCutoff || !previousPeriodEnd) return [];
    return metrics.filter(m => {
      const date = parseISO(m.metric_date);
      return !isBefore(date, previousPeriodCutoff) && !isAfter(date, previousPeriodEnd);
    });
  }, [metrics, previousPeriodCutoff, previousPeriodEnd]);

  // Previous period posts for comparison
  const previousPeriodPosts = useMemo(() => {
    if (!previousPeriodCutoff || !previousPeriodEnd) return [];
    return posts.filter(post => {
      if (!post.posted_at) return false;
      const date = parseISO(post.posted_at);
      return !isBefore(date, previousPeriodCutoff) && !isAfter(date, previousPeriodEnd);
    });
  }, [posts, previousPeriodCutoff, previousPeriodEnd]);

  // Filter stories by period (matching posts filtering logic)
  const filteredStories = useMemo(() => {
    if (period === "all") return stories;
    return stories.filter(story => {
      if (!story.posted_at) return false;
      const storyDate = parseISO(story.posted_at);
      if (cutoffDate && isBefore(storyDate, cutoffDate)) return false;
      if (endDate && isAfter(storyDate, endDate)) return false;
      return true;
    });
  }, [stories, cutoffDate, endDate, period]);

  // Previous period stories for comparison
  const previousPeriodStories = useMemo(() => {
    if (!previousPeriodCutoff || !previousPeriodEnd) return [];
    return stories.filter(story => {
      if (!story.posted_at) return false;
      const date = parseISO(story.posted_at);
      return !isBefore(date, previousPeriodCutoff) && !isAfter(date, previousPeriodEnd);
    });
  }, [stories, previousPeriodCutoff, previousPeriodEnd]);

  const hasPreviousStoriesData = previousPeriodStories.length > 0;

  // Helper to extract metrics from metadata safely
  const getMetadataValue = (m: PerformanceMetrics, key: string): number => {
    if (!m.metadata) return 0;
    const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
    return meta?.[key] || 0;
  };

  // Calculate KPIs from filtered data with trends
  const kpis = useMemo(() => {
    const totalLikes = filteredPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalSaves = filteredPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
    const totalShares = filteredPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalReachFromPosts = filteredPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
    
    // Calculate average engagement: if posts have engagement_rate use it, otherwise calculate
    let avgEngagement = 0;
    if (filteredPosts.length > 0) {
      const postsWithEngagement = filteredPosts.filter(p => p.engagement_rate && p.engagement_rate > 0);
      if (postsWithEngagement.length > 0) {
        avgEngagement = postsWithEngagement.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / postsWithEngagement.length;
      } else {
        // Calculate engagement from interactions / reach
        const totalInteractions = totalLikes + totalComments + totalSaves + totalShares;
        const totalReach = totalReachFromPosts || filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
        if (totalReach > 0) {
          avgEngagement = (totalInteractions / totalReach) * 100;
        }
      }
    }

    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    
    // Calculate followers GAINED - subscribers field contains DAILY new followers (not total)
    // So we SUM all daily values to get the total gained in the period
    const followersGained = filteredMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const totalReachFromMetrics = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0);
    const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const totalInteractions = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'interactions'), 0);
    const totalLinkClicks = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'linkClicks'), 0);
    const totalProfileVisits = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'profileVisits'), 0);

    const prevViews = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    
    // Calculate previous period followers gained - SUM daily values
    const prevFollowers = previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const prevReach = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0);
    const prevInteractions = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'interactions'), 0);
    const prevLinkClicks = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'linkClicks'), 0);
    const prevProfileVisits = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'profileVisits'), 0);

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      followersGained,
      followersChange: calcChange(followersGained, prevFollowers),
      totalPosts: filteredPosts.length,
      totalLikes,
      totalComments,
      totalSaves,
      totalShares,
      totalReach: totalReachFromMetrics || totalReachFromPosts,
      reachChange: calcChange(totalReachFromMetrics, prevReach),
      totalViews: totalViews || totalImpressions,
      viewsChange: calcChange(totalViews, prevViews),
      totalInteractions: totalInteractions,
      interactionsChange: calcChange(totalInteractions, prevInteractions),
      totalLinkClicks: totalLinkClicks,
      linkClicksChange: calcChange(totalLinkClicks, prevLinkClicks),
      totalProfileVisits: totalProfileVisits,
      profileVisitsChange: calcChange(totalProfileVisits, prevProfileVisits),
      avgEngagement: Math.round(avgEngagement * 100) / 100,
    };
  }, [filteredPosts, filteredMetrics, previousPeriodMetrics]);

  // Goals with calculated progress based on goal's own period (not dashboard filter)
  const goalsWithProgress = useMemo(() => {
    const instagramGoals = goals.filter(g => g.platform === 'instagram');
    
    return instagramGoals.map(goal => {
      // Calculate date range based on goal's period
      let startDate: Date;
      const endDate = new Date();
      
      switch(goal.period) {
        case 'weekly':
          startDate = subDays(endDate, 7);
          break;
        case 'monthly':
          startDate = subDays(endDate, 30);
          break;
        case 'quarterly':
          startDate = subDays(endDate, 90);
          break;
        case 'yearly':
          startDate = subDays(endDate, 365);
          break;
        default:
          startDate = subDays(endDate, 30);
      }
      
      // Filter metrics for the GOAL's period (not the dashboard filter)
      const goalPeriodMetrics = metrics.filter(m => {
        if (!m.metric_date) return false;
        const date = parseISO(m.metric_date);
        return isAfter(date, startDate) && isBefore(date, endDate);
      });
      
      // Filter posts for the GOAL's period
      const goalPeriodPosts = posts.filter(p => {
        if (!p.posted_at) return false;
        const date = parseISO(p.posted_at);
        return isAfter(date, startDate) && isBefore(date, endDate);
      });
      
      // Calculate current value based on metric type
      let currentValue = 0;
      switch(goal.metric_name) {
        case 'followers':
          currentValue = goalPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
          break;
        case 'views':
          currentValue = goalPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
          break;
        case 'reach':
          currentValue = goalPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0);
          break;
        case 'posts':
          currentValue = goalPeriodPosts.length;
          break;
        case 'engagement_rate':
          currentValue = goalPeriodPosts.length > 0
            ? goalPeriodPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / goalPeriodPosts.length
            : 0;
          break;
        case 'likes':
          currentValue = goalPeriodPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
          break;
        case 'comments':
          currentValue = goalPeriodPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
          break;
        case 'shares':
          currentValue = goalPeriodPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
          break;
        case 'saves':
          currentValue = goalPeriodPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
          break;
        case 'link_clicks':
          currentValue = goalPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'linkClicks'), 0);
          break;
        default:
          currentValue = 0;
      }
      
      return { ...goal, calculatedValue: currentValue };
    });
  }, [goals, metrics, posts]);

  const { deleteGoal } = usePerformanceGoals(clientId);

  // Sparkline data for KPIs (last 14 data points)
  const sparklineData = useMemo(() => {
    const recent = filteredMetrics.slice(0, 14).reverse();
    return {
      views: recent.map(m => m.views || 0),
      followers: recent.map(m => m.subscribers || 0),
      reach: recent.map(m => getMetadataValue(m, 'reach')),
      interactions: recent.map(m => getMetadataValue(m, 'interactions')),
      linkClicks: recent.map(m => getMetadataValue(m, 'linkClicks')),
      profileVisits: recent.map(m => getMetadataValue(m, 'profileVisits')),
    };
  }, [filteredMetrics]);

  // Post-based sparklines
  const postSparklines = useMemo(() => {
    const recentPosts = filteredPosts.slice(0, 14).reverse();
    return {
      shares: recentPosts.map(p => p.shares || 0),
      saves: recentPosts.map(p => p.saves || 0),
      engagement: recentPosts.map(p => p.engagement_rate || 0),
    };
  }, [filteredPosts]);

  // Prepare chart data
  const { chartData, availableMetrics } = useMemo(() => {
    const metricsMap: Record<string, { 
      views: number; 
      reach: number;
      interactions: number;
      linkClicks: number;
      subscribers: number; 
      profileVisits: number;
    }> = {};
    
    filteredMetrics.forEach(m => {
      const meta = m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : {};
      metricsMap[m.metric_date] = {
        views: m.views || 0,
        reach: meta?.reach || 0,
        interactions: meta?.interactions || 0,
        linkClicks: meta?.linkClicks || 0,
        subscribers: m.subscribers || 0,
        profileVisits: meta?.profileVisits || 0,
      };
    });

    const allDates = Object.keys(metricsMap).sort();

    if (allDates.length === 0) {
      return { chartData: [], availableMetrics: [] };
    }

    const data = allDates.map(dateKey => {
      const metricData = metricsMap[dateKey];
      
      return {
        date: format(parseISO(dateKey), "dd/MM", { locale: ptBR }),
        fullDate: dateKey,
        views: metricData.views,
        reach: metricData.reach,
        interactions: metricData.interactions,
        linkClicks: metricData.linkClicks,
        subscribers: metricData.subscribers,
        profileVisits: metricData.profileVisits,
      };
    });

    const hasViews = data.some(d => d.views > 0);
    const hasReach = data.some(d => d.reach > 0);
    const hasInteractions = data.some(d => d.interactions > 0);
    const hasLinkClicks = data.some(d => d.linkClicks > 0);
    const hasSubscribers = data.some(d => d.subscribers > 0);
    const hasProfileVisits = data.some(d => d.profileVisits > 0);

    const available = metricOptions.filter(opt => {
      if (opt.key === "views") return hasViews;
      if (opt.key === "reach") return hasReach;
      if (opt.key === "interactions") return hasInteractions;
      if (opt.key === "linkClicks") return hasLinkClicks;
      if (opt.key === "subscribers") return hasSubscribers;
      if (opt.key === "profileVisits") return hasProfileVisits;
      return false;
    });

    return { chartData: data, availableMetrics: available.length > 0 ? available : metricOptions };
  }, [filteredMetrics]);

  // Get best performing post
  const bestPost = useMemo(() => {
    if (filteredPosts.length === 0) return null;
    return filteredPosts.reduce((best, post) => 
      (post.engagement_rate || 0) > (best.engagement_rate || 0) ? post : best
    , filteredPosts[0]);
  }, [filteredPosts]);


  // Top posts for ranking
  const topPostsData = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => (b.reach || 0) - (a.reach || 0))
      .slice(0, 5)
      .map(post => ({
        label: post.caption?.slice(0, 40) + (post.caption && post.caption.length > 40 ? '...' : '') || 'Post sem legenda',
        value: post.reach || 0,
      }));
  }, [filteredPosts]);

  // Top posts for table - now includes all metrics for sorting
  const topContentItems = useMemo(() => {
    return filteredPosts.map(post => ({
      id: post.id,
      title: post.caption?.slice(0, 50) + (post.caption && post.caption.length > 50 ? '...' : '') || 'Post sem legenda',
      thumbnail: post.thumbnail_url,
      type: post.post_type || 'image',
      views: post.impressions || 0,
      likes: post.likes || 0,
      comments: post.comments || 0,
      saves: post.saves || 0,
      shares: post.shares || 0,
      reach: post.reach || 0,
      engagement: post.engagement_rate || 0,
      trend: (post.engagement_rate || 0) - kpis.avgEngagement,
      link: post.permalink,
    }));
  }, [filteredPosts, kpis.avgEngagement]);

  // Posting time heatmap data
  const heatmapData = useMemo(() => {
    const data: { day: number; hour: number; value: number; count: number }[] = [];
    
    // Initialize all slots
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push({ day, hour, value: 0, count: 0 });
      }
    }
    
    // Aggregate engagement by posting time
    filteredPosts.forEach(post => {
      if (!post.posted_at) return;
      const date = parseISO(post.posted_at);
      const day = getDay(date);
      const hour = getHours(date);
      
      const slot = data.find(d => d.day === day && d.hour === hour);
      if (slot) {
        slot.value += post.engagement_rate || 0;
        slot.count++;
      }
    });
    
    // Average the values
    data.forEach(slot => {
      if (slot.count > 0) {
        slot.value = slot.value / slot.count;
      }
    });
    
    return data;
  }, [filteredPosts]);

  // Data completeness stats
  const dataCompleteness = useMemo(() => ({
    total: posts.length,
    withThumbnails: posts.filter(p => p.thumbnail_url).length,
    withLikes: posts.filter(p => p.likes !== null && p.likes !== undefined).length,
    withReach: posts.filter(p => p.reach !== null && p.reach !== undefined && p.reach > 0).length,
    withEngagement: posts.filter(p => p.engagement_rate !== null && p.engagement_rate !== undefined).length,
  }), [posts]);

  // Check which metrics have data for alerts
  const metricsStatus = useMemo(() => {
    const hasViews = filteredMetrics.some(m => m.views && m.views > 0);
    const hasReach = filteredMetrics.some(m => getMetadataValue(m, 'reach') > 0);
    const hasInteractions = filteredMetrics.some(m => getMetadataValue(m, 'interactions') > 0);
    const hasLinkClicks = filteredMetrics.some(m => getMetadataValue(m, 'linkClicks') > 0);
    const hasFollowers = filteredMetrics.some(m => m.subscribers && m.subscribers > 0);
    const hasProfileVisits = filteredMetrics.some(m => getMetadataValue(m, 'profileVisits') > 0);

    return [
      { name: 'Visualizações', key: 'views', hasData: hasViews, count: filteredMetrics.filter(m => m.views && m.views > 0).length },
      { name: 'Contas alcançadas', key: 'reach', hasData: hasReach, count: filteredMetrics.filter(m => getMetadataValue(m, 'reach') > 0).length },
      { name: 'Interações', key: 'interactions', hasData: hasInteractions, count: filteredMetrics.filter(m => getMetadataValue(m, 'interactions') > 0).length },
      { name: 'Cliques no Link', key: 'linkClicks', hasData: hasLinkClicks, count: filteredMetrics.filter(m => getMetadataValue(m, 'linkClicks') > 0).length },
      { name: 'Seguidores', key: 'followers', hasData: hasFollowers, count: filteredMetrics.filter(m => m.subscribers && m.subscribers > 0).length },
      { name: 'Visitas ao Perfil', key: 'profileVisits', hasData: hasProfileVisits, count: filteredMetrics.filter(m => getMetadataValue(m, 'profileVisits') > 0).length },
    ];
  }, [filteredMetrics]);

  const selectedPeriodLabel = periodOptions.find(p => p.value === period)?.label || "Período";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Instagram Analytics</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-muted-foreground">
                {filteredPosts.length} posts • {filteredMetrics.length} dias de dados
              </p>
              {lastInstagramImport && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                  <Clock className="h-3 w-3" />
                  <span>
                    Atualizado: {format(new Date(lastInstagramImport.imported_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DataCompletenessWarning platform="instagram" data={dataCompleteness} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px] bg-card border-border/50">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {period === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {customDateFrom || customDateTo ? (
                      <span className="text-xs">
                        {customDateFrom ? format(customDateFrom, "dd/MM/yy") : "..."} - {customDateTo ? format(customDateTo, "dd/MM/yy") : "..."}
                      </span>
                    ) : (
                      <span className="text-xs">Selecionar datas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-4 p-4">
                    <div>
                      <Label className="text-xs font-medium mb-2 block">De</Label>
                      <CalendarComponent
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        locale={ptBR}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-2 block">Até</Label>
                      <CalendarComponent
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        locale={ptBR}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {canGenerateReports && (
            <Button 
              onClick={() => setShowReportGenerator(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" />
              Gerar Análise
            </Button>
          )}
          {canImportData && (
            <Button 
              variant="outline" 
              className="border-border/50"
              onClick={() => setShowUploadPosts(!showUploadPosts)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Report Generator Modal */}
      <PerformanceReportGenerator
        clientId={clientId}
        platform="Instagram"
        period={selectedPeriodLabel}
        kpis={kpis}
        previousKpis={{
          followersGained: previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0),
          totalReach: previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0),
          totalViews: previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0),
          totalInteractions: previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'interactions'), 0),
          totalLikes: previousPeriodPosts.reduce((sum, p) => sum + (p.likes || 0), 0),
          totalComments: previousPeriodPosts.reduce((sum, p) => sum + (p.comments || 0), 0),
          totalSaves: previousPeriodPosts.reduce((sum, p) => sum + (p.saves || 0), 0),
          totalShares: previousPeriodPosts.reduce((sum, p) => sum + (p.shares || 0), 0),
          totalPosts: previousPeriodPosts.length,
          avgEngagement: previousPeriodPosts.length > 0
            ? previousPeriodPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / previousPeriodPosts.length
            : 0,
        }}
        posts={filteredPosts}
        previousPosts={previousPeriodPosts}
        metrics={filteredMetrics}
        open={showReportGenerator}
        onOpenChange={setShowReportGenerator}
      />

      {/* CSV Upload - Smart (detecta automaticamente Posts ou Stories) */}
      {canImportData && (
        <Collapsible open={showUploadPosts} onOpenChange={setShowUploadPosts}>
          <CollapsibleContent className="pt-2">
            <SmartCSVUpload clientId={clientId} platform="instagram" />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Data Alert for missing metrics */}
      <MetricsDataAlert 
        metrics={metricsStatus} 
        platform="instagram" 
        onShowUpload={() => setShowUploadPosts(true)}
      />

      {/* Primary KPIs - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Eye}
          label="Visualizações"
          value={kpis.totalViews}
          change={period !== "all" ? kpis.viewsChange : undefined}
          sparklineData={sparklineData.views}
          color="violet"
          highlight
        />
        <StatCard
          icon={Target}
          label="Alcance"
          value={kpis.totalReach}
          change={period !== "all" ? kpis.reachChange : undefined}
          sparklineData={sparklineData.reach}
          color="blue"
        />
        <StatCard
          icon={Heart}
          label="Interações"
          value={kpis.totalInteractions}
          change={period !== "all" ? kpis.interactionsChange : undefined}
          sparklineData={sparklineData.interactions}
          color="rose"
        />
        <StatCard
          icon={Share2}
          label="Cliques no Link"
          value={kpis.totalLinkClicks}
          change={period !== "all" ? kpis.linkClicksChange : undefined}
          sparklineData={sparklineData.linkClicks}
          color="emerald"
        />
        <StatCard
          icon={Users}
          label="Novos Seguidores"
          value={kpis.followersGained}
          change={period !== "all" ? kpis.followersChange : undefined}
          sparklineData={sparklineData.followers}
          color="amber"
        />
        <StatCard
          icon={MessageCircle}
          label="Visitas ao Perfil"
          value={kpis.totalProfileVisits}
          change={period !== "all" ? kpis.profileVisitsChange : undefined}
          sparklineData={sparklineData.profileVisits}
          color="secondary"
        />
      </div>

      {/* Goals Section - Independent of date filter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Metas
          </h3>
          <div className="flex items-center gap-3">
            {goalsWithProgress.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Calculadas independentemente do filtro
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowGoalDialog(true)} className="gap-1">
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
          </div>
        </div>
        
        {goalsWithProgress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goalsWithProgress.map(goal => (
              <GoalProgressCard 
                key={goal.id}
                goal={goal}
                currentValue={goal.calculatedValue}
                onDelete={(id) => deleteGoal.mutate(id)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Target className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma meta definida</p>
              <p className="text-xs text-muted-foreground mb-3">Defina metas semanais ou mensais para acompanhar seu progresso</p>
              <Button size="sm" onClick={() => setShowGoalDialog(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                Criar Primeira Meta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && availableMetrics.length > 0 && (
        <EnhancedAreaChart
          data={chartData}
          metrics={availableMetrics}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          title="Evolução das Métricas"
          dateRange={selectedPeriodLabel}
        />
      )}

      {/* Best Posts by Metric - New Section like Instagram Native */}
      <BestPostsByMetric 
        posts={filteredPosts}
        previousPeriodPosts={previousPeriodPosts}
        periodLabel={selectedPeriodLabel}
      />


      {/* Top 3 Posts Grid */}
      {filteredPosts.length > 0 && (
        <TopPostsGrid 
          posts={filteredPosts}
          maxItems={3}
          selectedMetric={topPostsMetric}
          onMetricChange={(m) => setTopPostsMetric(m)}
        />
      )}

      {/* Post Averages Section - Temporariamente desativado
         Motivo: Os cálculos estão incorretos porque totalReach usa métricas da conta inteira
         (stories, reels, etc) mas divide pelo número de posts do feed apenas.
         Correção: Usar apenas totalReachFromPosts para médias por post.
      <PostAveragesSection
        totalPosts={filteredPosts.length}
        totalLikes={kpis.totalLikes}
        totalComments={kpis.totalComments}
        totalShares={kpis.totalShares}
        totalSaves={kpis.totalSaves}
        totalReach={kpis.totalReach}
        totalImpressions={filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0)}
        avgEngagement={kpis.avgEngagement}
      />
      */}

      {/* Secondary Metrics - Removido: dados duplicados com a seção BestPostsByMetric acima */}


      {/* Posts Table - Advanced */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <InstagramPostsTableAdvanced 
            posts={filteredPosts} 
            isLoading={isLoadingPosts}
            clientId={clientId}
          />
        </CardContent>
      </Card>

      {/* Stories Metrics Cards */}
      <InstagramStoriesMetricsCards
        stories={filteredStories}
        previousStories={previousPeriodStories}
        hasPreviousData={hasPreviousStoriesData}
      />

      {/* Stories Section */}
      <InstagramStoriesSection 
        stories={filteredStories}
        isLoading={isLoadingStories}
        period={period}
        clientId={clientId}
        onRefresh={() => refetchStories?.()}
      />

      {/* Import History */}
      <ImportHistoryPanel clientId={clientId} platform="instagram" />

      {/* Goal Creation Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Criar Nova Meta
            </DialogTitle>
          </DialogHeader>
          <CreateGoalForm 
            clientId={clientId}
            onSuccess={() => setShowGoalDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline form component for goal creation
function CreateGoalForm({ clientId, onSuccess }: { clientId: string; onSuccess: () => void }) {
  const { createGoal } = usePerformanceGoals(clientId);
  const [formData, setFormData] = useState({
    metric_name: "",
    target_value: 0,
    period: "monthly",
  });

  const goalMetricOptions = [
    { label: "Novos Seguidores", value: "followers" },
    { label: "Visualizações", value: "views" },
    { label: "Alcance", value: "reach" },
    { label: "Número de Posts", value: "posts" },
    { label: "Engajamento Médio (%)", value: "engagement_rate" },
    { label: "Curtidas", value: "likes" },
    { label: "Comentários", value: "comments" },
    { label: "Salvamentos", value: "saves" },
    { label: "Compartilhamentos", value: "shares" },
    { label: "Cliques no Link", value: "link_clicks" },
  ];

  const handleCreate = async () => {
    if (!formData.metric_name || !formData.target_value) return;

    await createGoal.mutateAsync({
      client_id: clientId,
      platform: "instagram",
      metric_name: formData.metric_name,
      target_value: formData.target_value,
      period: formData.period,
    });

    onSuccess();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Métrica</Label>
        <Select
          value={formData.metric_name}
          onValueChange={(v) => setFormData({ ...formData, metric_name: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma métrica" />
          </SelectTrigger>
          <SelectContent>
            {goalMetricOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Valor Alvo</Label>
        <Input
          type="number"
          value={formData.target_value || ""}
          onChange={(e) => setFormData({ ...formData, target_value: Number(e.target.value) })}
          placeholder="Ex: 10000"
        />
        {formData.metric_name === "engagement_rate" && (
          <p className="text-xs text-muted-foreground">Para engajamento, use valores em % (ex: 5 para 5%)</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Período</Label>
        <Select
          value={formData.period}
          onValueChange={(v) => setFormData({ ...formData, period: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button 
          onClick={handleCreate} 
          disabled={createGoal.isPending || !formData.metric_name || !formData.target_value}
        >
          Criar Meta
        </Button>
      </DialogFooter>
    </div>
  );
}
