const { prisma } = require('../index');

/**
 * POST /api/v1/reports
 * Generate a report for a test result
 */
exports.generateReport = async (req, res) => {
  try {
    const { testResultId } = req.body;
    const userId = req.user.id;

    if (!testResultId) {
      return res.status(400).json({ error: 'Test result ID required' });
    }

    // Get test result
    const testResult = await prisma.testResult.findUnique({
      where: { id: testResultId },
      include: { user: true },
    });

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' });
    }

    if (testResult.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if report already exists
    const existingReport = await prisma.report.findUnique({
      where: { testResultId },
    });

    if (existingReport) {
      return res.json({
        id: existingReport.id,
        testResultId: existingReport.testResultId,
        message: 'Report already exists',
      });
    }

    // Generate report content
    const reportContent = generateReportContent(testResult);

    // Determine free vs premium sections
    const isMember = testResult.user.isMember;
    const freeSections = generateFreeSections(reportContent, isMember);
    const premiumSections = isMember ? [] : generatePremiumSections(reportContent);

    // Create report
    const report = await prisma.report.create({
      data: {
        testResultId,
        userId,
        title: `人格分析报告 - ${testResult.personalityType || '探索者'}`,
        summary: reportContent.summary,
        content: reportContent,
        freeSections,
        premiumSections,
        isUnlocked: isMember,
      },
    });

    // Update user test count
    await prisma.user.update({
      where: { id: userId },
      data: { testCount: { increment: 1 } },
    });

    // Update test result stability index
    const stabilityIndex = calculateStabilityIndex(testResult.user.testCount + 1);
    await prisma.testResult.update({
      where: { id: testResultId },
      data: { stabilityIndex },
    });

    res.json({
      id: report.id,
      testResultId: report.testResultId,
      title: report.title,
      isUnlocked: report.isUnlocked,
      createdAt: report.createdAt,
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

/**
 * GET /api/v1/reports/:id
 * Get report content
 */
exports.getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        testResult: {
          select: {
            dimensionScores: true,
            personalityType: true,
            stabilityIndex: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Increment view count
    await prisma.report.update({
      where: { id },
      data: { viewedCount: { increment: 1 } },
    });

    // Return full content if unlocked, otherwise only free sections
    const content = report.isUnlocked 
      ? report.content 
      : { ...report.content, sections: report.freeSections };

    res.json({
      id: report.id,
      title: report.title,
      summary: report.summary,
      content,
      isUnlocked: report.isUnlocked,
      viewedCount: report.viewedCount,
      createdAt: report.createdAt,
      testResult: report.testResult,
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
};

/**
 * GET /api/v1/reports
 * Get user's report history
 */
exports.getReportHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const reports = await prisma.report.findMany({
      where: { userId },
      include: {
        testResult: {
          select: {
            personalityType: true,
            stabilityIndex: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    const total = await prisma.report.count({
      where: { userId },
    });

    res.json({
      reports: reports.map(r => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        isUnlocked: r.isUnlocked,
        viewedCount: r.viewedCount,
        createdAt: r.createdAt,
        personalityType: r.testResult?.personalityType,
        stabilityIndex: r.testResult?.stabilityIndex,
        completedAt: r.testResult?.completedAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get report history error:', error);
    res.status(500).json({ error: 'Failed to get report history' });
  }
};

// Helper function to generate report content
function generateReportContent(testResult) {
  const { dimensionScores, personalityType } = testResult;
  const scores = typeof dimensionScores === 'string' 
    ? JSON.parse(dimensionScores) 
    : dimensionScores;

  return {
    summary: `您的人格类型为 ${personalityType || '探索者'}，在四个维度上展现出独特的特征。`,
    sections: [
      {
        title: '人格类型概述',
        content: `您的 MBTI 人格类型为 ${personalityType || '探索者'}。这种类型的人通常具有独特的思维方式和行为模式。`,
      },
      {
        title: '四维得分详解',
        content: `
          - 开放性 (Openness): ${scores.openness || 50}/100
          - 尽责性 (Conscientiousness): ${scores.conscientiousness || 50}/100
          - 外向性 (Extraversion): ${scores.extraversion || 50}/100
          - 神经质 (Neuroticism): ${scores.neuroticism || 50}/100
        `,
      },
      {
        title: '优势分析',
        content: '基于您的测试结果，您在以下方面具有优势...',
      },
      {
        title: '发展建议',
        content: '为了进一步发展，建议您关注以下方面...',
      },
      {
        title: '职业匹配',
        content: '根据您的性格特征，以下职业可能更适合您...',
      },
      {
        title: '人际关系',
        content: '在人际交往中，您倾向于...',
      },
      {
        title: '压力管理',
        content: '面对压力时，您可能会...',
      },
      {
        title: '学习风格',
        content: '您的学习风格偏向于...',
      },
    ],
  };
}

// Helper function to generate free sections
function generateFreeSections(content, isMember) {
  if (isMember) return content.sections;
  // Free users get first 3 sections
  return content.sections.slice(0, 3);
}

// Helper function to generate premium sections
function generatePremiumSections(content) {
  // Premium sections are the remaining sections
  return content.sections.slice(3);
}

// Helper function to calculate stability index
function calculateStabilityIndex(testCount) {
  if (testCount <= 1) return 30;
  if (testCount <= 3) return 50;
  if (testCount <= 5) return 70;
  if (testCount <= 10) return 85;
  return 95;
}
