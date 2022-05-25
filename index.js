const fs = require("fs");
const { exit } = require("process");
const axios = require("axios");
const PromisePool = require("es6-promise-pool");

const C = {
  BASE_URL: "https://BITBUCKET-SERVER/bitbucket/rest/api/1.0/projects/{project}",
  GET_MERGED_PULL_REQUESTS_PATH: "repos/{repository}/pull-requests?state=MERGED&at=refs/heads/{branchName}&limit=100",
  GET_PULL_REQUEST_ACTIVITIES_PATH: "repos/{repository}/pull-requests/{pullRequestId}/activities?&limit=100",
  GET_PULL_REQUEST_COMMITS_PATH: "repos/{repository}/pull-requests/{pullRequestId}/commits",
  CONCURRENT_CALLS: 20
};

exports.handler = async (event) => {

  // Month 0-11
  var startDate = "";//new Date(2022, 0, 1);
  var endDate = "";//new Date(2023, 0, 1);
  var branchName = "";
  var repositories = [];

  let pullRequests = [];

  async function getPullRequestActivities(repository, pullRequestId) {
    const URL = C.GET_PULL_REQUEST_ACTIVITIES_PATH.replace(
      "{repository}",
      repository
    ).replace("{pullRequestId}", pullRequestId);

    let response;
    try {
      response = await axios.get(URL);
    }
    catch (e) {
      console.log(e);
    }
    return response.data.values;
  }

  async function getMergedPullRequests(repository) {
    const response = await axios.get(
      C.GET_MERGED_PULL_REQUESTS_PATH.replace("{repository}", repository).replace("{branchName}", branchName)
    );
    return response.data.values;
  }

  async function getPullRequestCommits(repository, pullRequestId) {
    const URL = C.GET_PULL_REQUEST_COMMITS_PATH.replace(
      "{repository}",
      repository
    ).replace("{pullRequestId}", pullRequestId);

    const response = await axios.get(URL);

    return response.data.values;
  }

  let createGetPullRequestsPromise = (repository) => {
    return new Promise(async (resolve, reject) => {
      try {
        const prs = await getMergedPullRequests(repository);

        resolve({ repository, prs });
      }
      catch (e) {
        reject(e);
      }
    });
  };

  let createGetPullRequestActivitiesPromise = (repository, pullRequestId) => {
    return new Promise(async (resolve, reject) => {
      try {
        const activities = await getPullRequestActivities(
          repository,
          pullRequestId
        );

        resolve({ repository, pullRequestId, activities });
      }
      catch (e) {
        reject(e);
      }
    });
  };

  let createGetPullRequestCommitsPromise = (repository, pullRequestId) => {
    return new Promise(async (resolve, reject) => {
      try {
        const commits = await getPullRequestCommits(repository, pullRequestId);

        resolve({ repository, pullRequestId, commits });
      }
      catch (e) {
        reject(e);
      }
    });
  };

  function timeDifference(date1, date2) {
    var date1 = new Date(date1).getTime();
    var date2 = new Date(date2).getTime();
    var difference = date1 - date2;
    var daysDifference = Math.floor(difference / 1000 / 60 / 60 / 24);
    difference -= daysDifference * 1000 * 60 * 60 * 24;
    var hoursDifference = Math.floor(difference / 1000 / 60 / 60);
    difference -= hoursDifference * 1000 * 60 * 60;
    var minutesDifference = Math.floor(difference / 1000 / 60);
    difference -= minutesDifference * 1000 * 60;
    return (
      daysDifference +
      " day/s " +
      hoursDifference +
      " hour/s " +
      minutesDifference +
      " minute/s "
    );
  }

  function diffHours(dt2, dt1) {
    var date1 = new Date(dt1).getTime();
    var date2 = new Date(dt2).getTime();
    var diff = (date2 - date1) / 1000;
    diff /= (60 * 60);
    return Math.abs(Math.round(diff));

  }

  function configureAxios(bitBucketKey, project) {
    axios.defaults.baseURL = C.BASE_URL.replace("{project}", project);
    axios.defaults.headers.common["Authorization"] =
      "Bearer " + bitBucketKey;
  }

  let getLongFormatDate = (milliseconds) =>
    `${new Date(milliseconds).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })}`;

  async function loadPullRequests() {
    let repoPromises = [];
    // Creates promises to load repositories
    repositories.forEach((repository) => {
      let repoPromise = createGetPullRequestsPromise(repository);


      // Sets promise callbacks
      repoPromise.then((response) => {
        // Removes the prs out of date range

        response.prs
          .filter(
            (pr) =>
              new Date(pr.createdDate).getTime() >= startDate.getTime() &&
              new Date(pr.closedDate).getTime() <= endDate.getTime() && pr.toRef.id == `refs/heads/${branchName}`
          )
          .forEach((pr) => {
            let createdDate = getLongFormatDate(pr.createdDate);
            let closedDate = getLongFormatDate(pr.closedDate);

            pullRequests.push({
              repository: response.repository,
              summary: pr.title,
              id: pr.id,
              owner: pr.fromRef.displayId.indexOf("/") > -1 ? pr.fromRef.displayId.split("/")[1].substring(0, 2) : pr.fromRef.displayId,
              ticket: pr.fromRef.displayId.split("_")[1],
              link: pr.links.self != null ? pr.links.self[0].href : "",
              reviewers: pr.reviewers != null ? pr.reviewers.length : 0,
              duration: timeDifference(pr.closedDate, pr.createdDate),
              durationInHours: diffHours(pr.closedDate, pr.createdDate),
              createdDate,
              closedDate,
              createdDateMilli: new Date(pr.createdDate).getTime(),
              closedDateMilli: new Date(pr.closedDate).getTime(),
            });
          });
      });
      repoPromises.push(repoPromise);
    });

    // Waits 'till all repositories were loaded
    await Promise.all(repoPromises);
  }

  async function loadPullRequestActivities() {
    let pool = new PromisePool(function* () {
      // Creates promises to load activities
      for (const pr of pullRequests) {
        let promise = createGetPullRequestActivitiesPromise(pr.repository, pr.id);
        yield promise;

        // Sets promise callbacks
        promise.then((response) => {
          const prIndex = pullRequests.findIndex(
            (el) =>
              el.id == response.pullRequestId &&
              el.repository == response.repository
          );
          let updatesCount = 0;
          let commentsCount = 0;
          let reviewsCount = 0;
          let mergesCount = 0;
          let fixesCount = 0;

          let approvals = [];

          response.activities.forEach((activity) => {
            switch (activity.action) {
              case "RESCOPED":
                updatesCount++;
                if (
                  activity.added.commits != null &&
                  activity.added.commits.length > 0
                ) {
                  mergesCount += activity.added.commits.filter(
                    (commit) => commit.parents.length > 1
                  ).length;
                }
                break;
              case "COMMENTED":
                commentsCount++;

                if (activity.commentAction == "ADDED" && activity.comment != null && activity.comment.comments.length > 0 &&
                  activity.comment.comments.filter(c => c.text.toLowerCase().indexOf("done") > -1 || c.text.toLowerCase().indexOf("fixed") > -1).length > 0) {
                  fixesCount++;
                }
                break;
              case "REVIEWED":
                reviewsCount++;
                break;
              case "APPROVED":
                let email = activity.user.emailAddress;
                let approveIndex = approvals.findIndex((el) => el.email == email);
                if (approveIndex > -1) {
                  approvals[approveIndex].count++;
                }
                else {
                  approvals.push({ email, count: 1 });
                }
                break;
            }
          });
          const reapprovals = approvals.filter((approval) => approval.count > 1);
          if (reapprovals.length > 0) {
            let reapprovalsCount = reapprovals
              .map((approval) => approval.count - 1)
              .reduce((acumulator, value) => acumulator + value);
            pullRequests[prIndex].reapprovalsCount = reapprovalsCount;
          }
          else {
            pullRequests[prIndex].reapprovalsCount = 0;
          }

          pullRequests[prIndex].updatesCount = updatesCount;
          pullRequests[prIndex].commentsCount = commentsCount;
          pullRequests[prIndex].needsWorkCount = reviewsCount;
          pullRequests[prIndex].mergesCount = mergesCount;
          pullRequests[prIndex].fixesCount = fixesCount;
          pullRequests[prIndex].approvals = approvals
            .map((approval) => approval.email + " : " + approval.count)
            .join(" | ");
        });

        //await promise;
        //activitiesPromises.push(promise);
      }
    }, C.CONCURRENT_CALLS);

    await pool.start();
    // Waits 'till all activities were loaded
    //await Promise.all(activitiesPromises);
  }

  async function loadPullRequestCommits() {
    let commitsPromises = [];
    let pool = new PromisePool(function* () {
      for (const pr of pullRequests) {
        let promise = createGetPullRequestCommitsPromise(pr.repository, pr.id);
        yield promise;

        // Sets promise callbacks
        promise.then((response) => {
          const prIndex = pullRequests.findIndex(
            (el) =>
              el.id == response.pullRequestId &&
              el.repository == response.repository
          );

          const commitsAfterPrCreation = response.commits.filter(
            (commit) => commit.authorTimestamp > pr.createdDateMilli
          );

          pullRequests[prIndex].commitsCount =
            commitsAfterPrCreation.length - pr.mergesCount;
        });
      }
    }, C.CONCURRENT_CALLS);

    // Waits 'till all commits were loaded
    await pool.start();
  }

  //let body = JSON.parse(event.body)
  configureAxios(body.bitBucketKey,body.project);

  startDate = new Date(Number.parseInt(body.startDate));
  endDate = new Date(Number.parseInt(body.endDate));
  branchName = body.branchName;
  repositories = body.repositories;

  console.log("Loading pull requests...")
  await loadPullRequests();
  console.log("Loading pull requests activities...")
  await loadPullRequestActivities();
  console.log("Loading pull requests commits...")
  await loadPullRequestCommits();
  console.log("Data processed successfully.")

  pullRequests.sort((a, b) => a.closedDateMilli - b.closedDateMilli);

  console.log("Done.")

  const response = {
    statusCode: 200,
    body: JSON.stringify({ pullRequests }),
  };

  console.log(response)

  return response;
};

exports.handler();