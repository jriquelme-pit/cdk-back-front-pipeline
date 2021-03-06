import * as cdk from "@aws-cdk/core";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codebuild from "@aws-cdk/aws-codebuild";
import * as codepipelineActions from "@aws-cdk/aws-codepipeline-actions";
import * as codecommit from "@aws-cdk/aws-codecommit";
import * as s3 from "@aws-cdk/aws-s3";

export interface SimpleWebsitePipelineStackProps extends cdk.StackProps {
  /*github: {
    owner: string
    repository: string
    branch: string
    oauthToken: string
  }*/
  bucket: {
    arn: string
  }
  codeRepo: {
    repoName: string
  }
}

export class SimpleWebsitePipeline extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: SimpleWebsitePipelineStackProps) {
    super(scope, id);

    const outputSources = new codepipeline.Artifact();
    const outputWebsite = new codepipeline.Artifact();
    const code = codecommit.Repository.fromRepositoryName(this, 'ImportedRepo', props.codeRepo.repoName);


    const pipeline = new codepipeline.Pipeline(this, 'pipeline', {
      pipelineName: `${id}-pipeline`,
      artifactBucket: s3.Bucket.fromBucketArn(this, 'ArtifactBucketByArn', 'arn:aws:s3:::pit-pipeline-artifact-store'),
      restartExecutionOnUpdate: true
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipelineActions.CodeCommitSourceAction({
          actionName: 'CodeCommit_Source',
          repository: code,
          output: outputSources,
        })
        /*new codepipelineActions.GitHubSourceAction({
          actionName: 'Checkout',
          owner: props.github.owner,
          repo: props.github.repository,
          branch: props.github.branch,
          oauthToken: cdk.SecretValue.plainText(props.github.oauthToken),
          output: outputSources,
          trigger: codepipelineActions.GitHubTrigger.WEBHOOK
        })*/
      ]
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        // AWS CodePipeline action to run CodeBuild project
        new codepipelineActions.CodeBuildAction({
          actionName: `${id}-Website`,
          project: new codebuild.PipelineProject(this, `${id}-BuildWebsite`, {
            projectName: `${id}-Website`,
            buildSpec: codebuild.BuildSpec.fromSourceFilename('./infra/buildspec.yml'),
          }),
          input: outputSources,
          outputs: [outputWebsite],
        }),
      ],
    });

    const bucket = s3.Bucket.fromBucketArn(this, 'BucketByArn', props.bucket.arn);

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        // AWS CodePipeline action to deploy CRA website to S3
        new codepipelineActions.S3DeployAction({
          actionName: `${id}-Website`,
          input: outputWebsite,
          bucket: bucket,
        }),
      ],
    })
  }
}
