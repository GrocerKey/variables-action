const core = require('@actions/core');
const github = require('@actions/github');
const aws = require('aws-sdk');

try {    
  const branch = core.getInput('branch');  
  const env = core.getInput('env');
  const secrets = core.getInput('secrets');

  setEnvironment(branch);
  configureAWS('j', 'j', 'j')
  loadVariables(env, secrets);
}

catch (error) {
  core.setFailed(error.message);
}

function setEnvironment(branchName) 
{
    var branchSuffix = branchName.replace('refs/heads/','').toLowerCase();
    var isFeatureBranch = false;
    var environment = '';
  
    switch (branchSuffix) 
    {
      case 'production':
        environment = 'PRODUCTION';
        break;
      case 'staging':
       environment = 'STAGING';
       break;
      case 'master':
      case 'main':
        environment = 'DEVELOPMENT';
        break;
      default:
       isFeatureBranch = true;
       environment = 'DEVELOPMENT';     
   }
   core.exportVariable('IS_FEATURE_BRANCH', isFeatureBranch);
   core.exportVariable('ENVIRONMENT', environment);

  
}

function loadVariables(env, secrets) {

  var variables = env.split(' ');
  
  if(secrets != '') {
    variables = variables.concat(secrets.split(' '));
  }
  
  variables.forEach(function(part, index, theArray) {
     theArray[index] = `/ci/${theArray[index]}`; 
  });
  
  var ssm = new aws.SSM();

  ssm.getParameters({
    Names: variables,
    WithDecryption: true
  }).then((output) => {   
      output.Parameters.forEach((item) => {
        var keyName = item.Name.replace('/ci/','');
        core.exportVariable(keyName, item.Value);
        if(secrets.includes(keyName))
        {
          core.setSecret(item.Value);
        }
      });
  }).catch(function (err) {
      core.setFailed(err);
  });
  
  
}

function configureAWS(accessKey, secretKey, roleToAssume) {
   
   const sts = getStsClient('us-east-1', accessKey, secretKey);

    sts.assumeRole({
      RoleArn: roleToAssume
    })
    .promise()
    .then(function (data) {
      aws.config.update({
         accessKeyId: data.Credentials.AccessKeyId,
         secretAccessKey: data.Credentials.SecretAccessKey,
         sessionToken: data.Credentials.SessionToken,
      });
  });
}

function getStsClient(region, accessKey, secretKey) {
    return new aws.STS({
      credentials = {
        accessKeyId:accessKey,
        secretAccessKey:secretKey
      },
      region : region,
      stsRegionalEndpoints: 'regional',
    });
  }
